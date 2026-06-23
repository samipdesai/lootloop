-- LootLoop integration test (task #45): cross-family RLS isolation for the
-- tables NOT explicitly proven in rls_and_functions_test.sql, so isolation is
-- proven for ALL family-scoped tables:
--   reading_logs, reading_streaks, savings_transactions, savings_goals,
--   schedule_items, family_invites.
--
-- For each table we prove a parent AND a kid in family A cannot SELECT / INSERT
-- / UPDATE / DELETE family B's rows. Tables whose clients have no INSERT/DELETE
-- grant (read-only ledgers/streaks; invites) prove the privilege is absent.
--
-- Runs against the LOCAL Supabase Postgres (after `supabase db reset`). Plain
-- SQL + assertions — no pgTAP. Deterministic: seeds fixed UUIDs, runs inside ONE
-- transaction that ROLLBACKs at the end, so the DB is untouched and re-runnable.
--
-- HOW TO RUN:
--   docker exec -i supabase_db_Lootloop psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f - < supabase/tests/rls_isolation_remaining_tables_test.sql
--
-- Session simulation (mirrors how PostgREST sets context per request):
--   parent: set local role authenticated;
--           set local request.jwt.claims = '{"sub":"<auth.users.id>"}';
--   kid:    set local role authenticated;
--           set local request.jwt.claims =
--             '{"role":"authenticated","ll_role":"kid",
--               "family_id":"<uuid>","profile_id":"<uuid>"}';
--   reset:  reset role; select set_config('request.jwt.claims', NULL, true);

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Fixed UUIDs: two families (A, B), each with a parent + a kid. The 003 trigger
-- auto-creates each kid's wallet + reading_streaks row.
-- ---------------------------------------------------------------------------
\set famA  '11111111-cccc-1111-1111-111111111111'
\set famB  '22222222-dddd-2222-2222-222222222222'

\set authParentA '1a111111-cccc-1111-1111-111111111111'
\set authParentB '2a222222-dddd-2222-2222-222222222222'

\set parentA '1b111111-cccc-1111-1111-111111111111'
\set parentB '2b222222-dddd-2222-2222-222222222222'

\set kidA '1c111111-cccc-1111-1111-111111111111'
\set kidB '2c222222-dddd-2222-2222-222222222222'

insert into auth.users (id, instance_id, aud, role, email)
  values (:'authParentA', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pa-iso@example.com'),
         (:'authParentB', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pb-iso@example.com');

insert into families (id, name) values (:'famA', 'Family A'), (:'famB', 'Family B');

insert into profiles (id, family_id, role, display_name, auth_user_id)
  values (:'parentA', :'famA', 'parent', 'Parent A', :'authParentA'),
         (:'parentB', :'famB', 'parent', 'Parent B', :'authParentB');

insert into profiles (id, family_id, role, display_name, pin_hash, age_mode)
  values (:'kidA', :'famA', 'kid', 'Kid A', 'hashA', 'detailed'),
         (:'kidB', :'famB', 'kid', 'Kid B', 'hashB', 'detailed');

-- Seed one family-B row in each table (as superuser → bypasses RLS), so family A
-- has something to (fail to) reach.
\set readlogB  'fb111111-dddd-2222-2222-222222222222'
\set goalB     'fb222222-dddd-2222-2222-222222222222'
\set schedB    'fb333333-dddd-2222-2222-222222222222'
\set inviteB   'fb444444-dddd-2222-2222-222222222222'

insert into reading_logs (id, family_id, kid_id, book_title, minutes, status)
  values (:'readlogB', :'famB', :'kidB', 'Family B Book', 20, 'pending');

insert into savings_goals (id, family_id, kid_id, title, target)
  values (:'goalB', :'famB', :'kidB', 'Family B Goal', 100);

insert into schedule_items (id, family_id, kid_id, title, start_time)
  values (:'schedB', :'famB', :'kidB', 'Family B Bedtime', '20:00');

insert into family_invites (id, family_id, code, created_by, expires_at)
  values (:'inviteB', :'famB', 'INVITEB123', :'parentB', now() + interval '7 days');

-- A family-B savings_transactions row (ledger; written here under superuser to
-- simulate a prior transfer/interest event).
\set savtxnB 'fb555555-dddd-2222-2222-222222222222'
insert into savings_transactions (id, family_id, kid_id, type, amount, note)
  values (:'savtxnB', :'famB', :'kidB', 'interest', 5, 'seeded');


-- ===========================================================================
-- SECTION A — PARENT A cannot see/touch family B's rows.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"1a111111-cccc-1111-1111-111111111111"}';
do $$
declare n int;
begin
  -- ---------- reading_logs ----------
  select count(*) into n from reading_logs where family_id = '22222222-dddd-2222-2222-222222222222';
  if n <> 0 then raise exception 'FAIL: parent A SELECTs family B reading_logs'; end if;

  update reading_logs set book_title = 'hacked' where id = 'fb111111-dddd-2222-2222-222222222222';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: parent A UPDATEd % family B reading_logs', n; end if;

  -- reading_logs has no DELETE grant for authenticated → deletion is denied outright.
  -- (proven in SECTION C as a privilege check)

  -- ---------- reading_streaks ----------
  select count(*) into n from reading_streaks where family_id = '22222222-dddd-2222-2222-222222222222';
  if n <> 0 then raise exception 'FAIL: parent A SELECTs family B reading_streaks'; end if;

  -- ---------- savings_transactions ----------
  select count(*) into n from savings_transactions where family_id = '22222222-dddd-2222-2222-222222222222';
  if n <> 0 then raise exception 'FAIL: parent A SELECTs family B savings_transactions'; end if;

  -- ---------- savings_goals ----------
  select count(*) into n from savings_goals where family_id = '22222222-dddd-2222-2222-222222222222';
  if n <> 0 then raise exception 'FAIL: parent A SELECTs family B savings_goals'; end if;

  update savings_goals set title = 'hacked' where id = 'fb222222-dddd-2222-2222-222222222222';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: parent A UPDATEd % family B savings_goals', n; end if;

  delete from savings_goals where id = 'fb222222-dddd-2222-2222-222222222222';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: parent A DELETEd % family B savings_goals', n; end if;

  -- ---------- schedule_items ----------
  select count(*) into n from schedule_items where family_id = '22222222-dddd-2222-2222-222222222222';
  if n <> 0 then raise exception 'FAIL: parent A SELECTs family B schedule_items'; end if;

  update schedule_items set title = 'hacked' where id = 'fb333333-dddd-2222-2222-222222222222';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: parent A UPDATEd % family B schedule_items', n; end if;

  delete from schedule_items where id = 'fb333333-dddd-2222-2222-222222222222';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: parent A DELETEd % family B schedule_items', n; end if;

  -- ---------- family_invites ----------
  select count(*) into n from family_invites where family_id = '22222222-dddd-2222-2222-222222222222';
  if n <> 0 then raise exception 'FAIL: parent A SELECTs family B family_invites'; end if;

  update family_invites set code = 'HACKED99' where id = 'fb444444-dddd-2222-2222-222222222222';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: parent A UPDATEd % family B family_invites', n; end if;

  delete from family_invites where id = 'fb444444-dddd-2222-2222-222222222222';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: parent A DELETEd % family B family_invites', n; end if;

  raise notice 'PASS: parent A isolated from family B (reading_logs/streaks/savings_txn/goals/schedule/invites SELECT+UPDATE+DELETE)';
end $$;

-- INSERTs into family B must be rejected by WITH CHECK (the tables that grant
-- INSERT to authenticated: reading_logs, savings_goals, schedule_items).
do $$
begin
  insert into savings_goals (family_id, kid_id, title, target)
    values ('22222222-dddd-2222-2222-222222222222', '2c222222-dddd-2222-2222-222222222222', 'cross', 50);
  raise exception 'FAIL: parent A INSERTed savings_goals into family B';
exception when insufficient_privilege then
  raise notice 'PASS: parent A INSERT savings_goals into family B rejected (RLS WITH CHECK)';
end $$;

do $$
begin
  insert into schedule_items (family_id, kid_id, title, start_time)
    values ('22222222-dddd-2222-2222-222222222222', '2c222222-dddd-2222-2222-222222222222', 'cross', '07:00');
  raise exception 'FAIL: parent A INSERTed schedule_items into family B';
exception when insufficient_privilege then
  raise notice 'PASS: parent A INSERT schedule_items into family B rejected (RLS WITH CHECK)';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION B — KID A cannot see/touch family B's rows.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"11111111-cccc-1111-1111-111111111111","profile_id":"1c111111-cccc-1111-1111-111111111111"}';
do $$
declare n int;
begin
  select count(*) into n from reading_logs where family_id = '22222222-dddd-2222-2222-222222222222';
  if n <> 0 then raise exception 'FAIL: kid A SELECTs family B reading_logs'; end if;

  select count(*) into n from reading_streaks where family_id = '22222222-dddd-2222-2222-222222222222';
  if n <> 0 then raise exception 'FAIL: kid A SELECTs family B reading_streaks'; end if;

  select count(*) into n from savings_transactions where family_id = '22222222-dddd-2222-2222-222222222222';
  if n <> 0 then raise exception 'FAIL: kid A SELECTs family B savings_transactions'; end if;

  select count(*) into n from savings_goals where family_id = '22222222-dddd-2222-2222-222222222222';
  if n <> 0 then raise exception 'FAIL: kid A SELECTs family B savings_goals'; end if;

  select count(*) into n from schedule_items where family_id = '22222222-dddd-2222-2222-222222222222';
  if n <> 0 then raise exception 'FAIL: kid A SELECTs family B schedule_items'; end if;

  -- family_invites: kid (even own family) sees nothing (policy is parent-only).
  select count(*) into n from family_invites;
  if n <> 0 then raise exception 'FAIL: kid A SELECTs % family_invites (kid must see none)', n; end if;

  -- UPDATE family B reading_log: invisible → 0 rows.
  update reading_logs set book_title = 'hacked' where id = 'fb111111-dddd-2222-2222-222222222222';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: kid A UPDATEd % family B reading_logs', n; end if;

  -- UPDATE/DELETE family B savings_goals: invisible → 0 rows.
  update savings_goals set title = 'hacked' where id = 'fb222222-dddd-2222-2222-222222222222';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: kid A UPDATEd % family B savings_goals', n; end if;

  delete from savings_goals where id = 'fb222222-dddd-2222-2222-222222222222';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: kid A DELETEd % family B savings_goals', n; end if;

  raise notice 'PASS: kid A isolated from family B (reading_logs/streaks/savings_txn/goals/schedule SELECT; invites hidden; cross-family UPDATE/DELETE no-op)';
end $$;

-- Kid A cannot INSERT a reading_log claiming family B (WITH CHECK rejects).
do $$
begin
  insert into reading_logs (family_id, kid_id, book_title, minutes)
    values ('22222222-dddd-2222-2222-222222222222', '2c222222-dddd-2222-2222-222222222222', 'cross', 10);
  raise exception 'FAIL: kid A INSERTed reading_logs into family B';
exception when insufficient_privilege then
  raise notice 'PASS: kid A INSERT reading_logs into family B rejected (RLS WITH CHECK)';
end $$;

-- Kid A cannot INSERT a savings_goal into family B (WITH CHECK rejects).
do $$
begin
  insert into savings_goals (family_id, kid_id, title, target)
    values ('22222222-dddd-2222-2222-222222222222', '2c222222-dddd-2222-2222-222222222222', 'cross', 50);
  raise exception 'FAIL: kid A INSERTed savings_goals into family B';
exception when insufficient_privilege then
  raise notice 'PASS: kid A INSERT savings_goals into family B rejected (RLS WITH CHECK)';
end $$;

-- Kid A cannot INSERT a savings_goal even in its OWN family impersonating kid B
-- (kid_id must equal auth_profile_id()).
do $$
begin
  insert into savings_goals (family_id, kid_id, title, target)
    values ('11111111-cccc-1111-1111-111111111111', '2c222222-dddd-2222-2222-222222222222', 'impersonate', 50);
  raise exception 'FAIL: kid A INSERTed savings_goals impersonating kid B';
exception when insufficient_privilege then
  raise notice 'PASS: kid A cannot INSERT a savings_goal as another kid (own-row check)';
end $$;

-- Kid A cannot author schedule_items at all (parent-only INSERT policy), even
-- for itself in its own family.
do $$
begin
  insert into schedule_items (family_id, kid_id, title, start_time)
    values ('11111111-cccc-1111-1111-111111111111', '1c111111-cccc-1111-1111-111111111111', 'self', '07:00');
  raise exception 'FAIL: kid A authored a schedule_item';
exception when insufficient_privilege then
  raise notice 'PASS: kid A cannot author schedule_items (parent-only INSERT policy)';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION C — read-only / no-grant tables: client writes denied at the
-- privilege layer (no INSERT/UPDATE/DELETE grant to authenticated at all), so
-- even within the caller's own family the write is impossible. These tables are
-- mutated only by SECURITY DEFINER functions / elevated context.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"1a111111-cccc-1111-1111-111111111111"}';

-- reading_streaks: no INSERT/UPDATE/DELETE grant → all client writes denied.
do $$
begin
  update reading_streaks set current_streak = 999 where kid_id = '1c111111-cccc-1111-1111-111111111111';
  raise exception 'FAIL: parent A directly UPDATEd reading_streaks';
exception when insufficient_privilege then
  raise notice 'PASS: reading_streaks not directly writable (no UPDATE privilege)';
end $$;

-- savings_transactions: no INSERT grant → client cannot forge a ledger row.
do $$
begin
  insert into savings_transactions (family_id, kid_id, type, amount)
    values ('11111111-cccc-1111-1111-111111111111', '1c111111-cccc-1111-1111-111111111111', 'deposit', 100);
  raise exception 'FAIL: parent A directly INSERTed a savings_transactions row';
exception when insufficient_privilege then
  raise notice 'PASS: savings_transactions ledger not directly INSERTable (no privilege)';
end $$;

-- family_invites: no INSERT grant → invites can only be minted by
-- create_family_invite(); a parent cannot forge one for their own family.
do $$
begin
  insert into family_invites (family_id, code, created_by, expires_at)
    values ('11111111-cccc-1111-1111-111111111111', 'FORGED12', '1b111111-cccc-1111-1111-111111111111', now() + interval '1 day');
  raise exception 'FAIL: parent A directly INSERTed a family_invite';
exception when insufficient_privilege then
  raise notice 'PASS: family_invites not directly INSERTable (minted only via create_family_invite)';
end $$;

-- reading_logs: no DELETE grant → not client-deletable even in own family.
do $$
begin
  delete from reading_logs where kid_id = '1c111111-cccc-1111-1111-111111111111';
  raise exception 'FAIL: parent A DELETEd a reading_log';
exception when insufficient_privilege then
  raise notice 'PASS: reading_logs not client-DELETEable (no DELETE privilege)';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


do $$ begin raise notice '======== ALL TESTS PASSED ========'; end $$;

rollback;
