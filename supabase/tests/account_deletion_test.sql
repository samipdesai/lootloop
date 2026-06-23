-- LootLoop integration test (task #52): leave_family() / delete_family() RPCs.
--
-- Runs against the LOCAL Supabase Postgres (after `supabase db reset`). Plain
-- SQL + assertions — no pgTAP. Deterministic: seeds fixed UUIDs, runs inside ONE
-- transaction that ROLLBACKs at the end, so the DB is untouched and re-runnable.
--
-- HOW TO RUN:
--   supabase db reset        # apply 001->009 fresh
--   docker exec -i supabase_db_Lootloop psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f - < supabase/tests/account_deletion_test.sql
--
-- A passing run prints "PASS:" NOTICEs and ends with "ALL TESTS PASSED".
--
-- Session simulation (mirrors how PostgREST sets context per request):
--   parent: set local role authenticated;
--           set local request.jwt.claims = '{"sub":"<auth.users.id>"}';
--   kid:    set local role authenticated;
--           set local request.jwt.claims =
--             '{"role":"authenticated","ll_role":"kid",
--               "family_id":"<uuid>","profile_id":"<uuid>"}';
--   reset:  reset role; select set_config('request.jwt.claims', NULL, true);
--
-- IMPORTANT: each function CALL is made under the simulated caller role; the
-- post-call ASSERTIONS run AFTER `reset role` (as the postgres superuser, which
-- bypasses RLS). This is required because leave_family/delete_family delete the
-- caller's own profile — after which the caller has no family under RLS and would
-- "see" nothing, defeating the assertions. Return values are captured into a temp
-- table inside the role-scoped block, then asserted post-reset.

\set ON_ERROR_STOP on

begin;

-- Scratch table for return values captured under the caller role, asserted later
-- as postgres. (Temp tables are RLS-exempt and visible across the txn.) The
-- caller role is `authenticated` (via SET ROLE), so it needs INSERT on this
-- postgres-owned temp table.
create temp table _ret (label text, val uuid);
grant insert on _ret to authenticated;

-- ---------------------------------------------------------------------------
-- Fixed UUIDs.
--   Family A: TWO parents (A1, A2) + one kid (KA) + a reward + a purchase
--             (the purchase exercises the reward_purchases -> rewards ON DELETE
--             RESTRICT FK during the family cascade in delete_family).
--   Family B: ONE parent (B1) + one kid (KB). Unrelated — used to prove
--             cross-family isolation (delete_family on A must not touch B).
-- ---------------------------------------------------------------------------
\set famA  '11111111-aaaa-1111-1111-111111111111'
\set famB  '22222222-bbbb-2222-2222-222222222222'

\set authA1 'a1111111-aaaa-1111-1111-111111111111'
\set authA2 'a2222222-aaaa-1111-1111-111111111111'
\set authB1 'b1111111-bbbb-2222-2222-222222222222'

\set parentA1 'aa111111-aaaa-1111-1111-111111111111'
\set parentA2 'aa222222-aaaa-1111-1111-111111111111'
\set parentB1 'bb111111-bbbb-2222-2222-222222222222'

\set kidA 'ac111111-aaaa-1111-1111-111111111111'
\set kidB 'bc222222-bbbb-2222-2222-222222222222'

\set rewardA 'ad111111-aaaa-1111-1111-111111111111'
\set purchaseA 'ae111111-aaaa-1111-1111-111111111111'

insert into auth.users (id, instance_id, aud, role, email) values
  (:'authA1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a1-del@example.com'),
  (:'authA2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a2-del@example.com'),
  (:'authB1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b1-del@example.com');

insert into families (id, name) values (:'famA', 'Family A'), (:'famB', 'Family B');

insert into profiles (id, family_id, role, display_name, auth_user_id) values
  (:'parentA1', :'famA', 'parent', 'Parent A1', :'authA1'),
  (:'parentA2', :'famA', 'parent', 'Parent A2', :'authA2'),
  (:'parentB1', :'famB', 'parent', 'Parent B1', :'authB1');

insert into profiles (id, family_id, role, display_name, pin_hash, age_mode) values
  (:'kidA', :'famA', 'kid', 'Kid A', 'hashA', 'detailed'),
  (:'kidB', :'famB', 'kid', 'Kid B', 'hashB', 'detailed');

-- A reward + a purchase in family A so the family cascade has to traverse the
-- reward_purchases -> rewards ON DELETE RESTRICT FK (both cascade from families).
insert into rewards (id, family_id, title, cost) values
  (:'rewardA', :'famA', 'Ice Cream', 50);
insert into reward_purchases (id, family_id, reward_id, kid_id, cost) values
  (:'purchaseA', :'famA', :'rewardA', :'kidA', 50);


-- ===========================================================================
-- SECTION 1 — leave_family: a CO-PARENT can leave.
--   Parent A1 leaves family A. Their profile is gone; the family, the other
--   parent (A2), and the kid (KA) all remain. The returned auth_user_id is A1's.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"a1111111-aaaa-1111-1111-111111111111"}';
insert into _ret (label, val) select 'leave_a1', leave_family();
reset role;
select set_config('request.jwt.claims', NULL, true);

do $$
declare v_ret uuid; n int;
begin
  select val into v_ret from _ret where label = 'leave_a1';
  if v_ret <> 'a1111111-aaaa-1111-1111-111111111111' then
    raise exception 'FAIL: leave_family returned wrong auth_user_id, got %', v_ret;
  end if;

  -- A1's profile is deleted.
  select count(*) into n from profiles where id = 'aa111111-aaaa-1111-1111-111111111111';
  if n <> 0 then raise exception 'FAIL: leaving parent profile still present (%)', n; end if;

  -- The family still exists.
  select count(*) into n from families where id = '11111111-aaaa-1111-1111-111111111111';
  if n <> 1 then raise exception 'FAIL: family A removed by leave_family (%)', n; end if;

  -- The other parent (A2) remains.
  select count(*) into n from profiles where id = 'aa222222-aaaa-1111-1111-111111111111';
  if n <> 1 then raise exception 'FAIL: co-parent A2 missing after A1 left (%)', n; end if;

  -- The kid remains.
  select count(*) into n from profiles where id = 'ac111111-aaaa-1111-1111-111111111111';
  if n <> 1 then raise exception 'FAIL: kid A removed by A1 leaving (%)', n; end if;

  raise notice 'PASS: co-parent leave_family -> own profile gone; family + other parent + kid intact; returns own auth_user_id';
end $$;


-- ===========================================================================
-- SECTION 2 — leave_family: the LAST parent CANNOT leave.
--   Family A now has exactly one parent (A2). A2 calling leave_family() must
--   RAISE (check_violation) and change nothing.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"a2222222-aaaa-1111-1111-111111111111"}';
do $$
begin
  begin
    perform leave_family();
    raise exception 'FAIL: last parent was allowed to leave';
  exception when check_violation then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

do $$
declare n int;
begin
  -- A2 still present; family still present.
  select count(*) into n from profiles where id = 'aa222222-aaaa-1111-1111-111111111111';
  if n <> 1 then raise exception 'FAIL: last parent profile removed despite guard (%)', n; end if;
  select count(*) into n from families where id = '11111111-aaaa-1111-1111-111111111111';
  if n <> 1 then raise exception 'FAIL: family removed despite last-parent guard (%)', n; end if;

  raise notice 'PASS: the LAST parent CANNOT leave_family (raises; nothing changes)';
end $$;


-- ===========================================================================
-- SECTION 3 — AUTHZ: a KID cannot leave_family or delete_family.
--   Kid B (a kid session) is rejected by BOTH (insufficient_privilege).
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"22222222-bbbb-2222-2222-222222222222","profile_id":"bc222222-bbbb-2222-2222-222222222222"}';
do $$
begin
  begin
    perform leave_family();
    raise exception 'FAIL: kid was allowed to leave_family';
  exception when insufficient_privilege then null;
  end;
  begin
    perform delete_family();
    raise exception 'FAIL: kid was allowed to delete_family';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

do $$
declare n int;
begin
  -- Family B fully intact (1 family + 1 parent + 1 kid).
  select count(*) into n from families where id = '22222222-bbbb-2222-2222-222222222222';
  if n <> 1 then raise exception 'FAIL: family B changed by kid call (%)', n; end if;
  select count(*) into n from profiles where family_id = '22222222-bbbb-2222-2222-222222222222';
  if n <> 2 then raise exception 'FAIL: family B profiles changed by kid call (%)', n; end if;

  raise notice 'PASS: a kid is rejected by BOTH leave_family and delete_family (family untouched)';
end $$;


-- ===========================================================================
-- SECTION 4 — AUTHZ: an UNAUTHENTICATED caller (no jwt claims) is rejected by
-- both functions (insufficient_privilege).
-- ===========================================================================
set local role authenticated;
do $$
begin
  begin
    perform leave_family();
    raise exception 'FAIL: unauthenticated caller leave_family succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform delete_family();
    raise exception 'FAIL: unauthenticated caller delete_family succeeded';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: an unauthenticated caller is rejected by both functions';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION 5 — delete_family: a parent wipes ONLY their own family.
--   Parent A2 deletes family A. delete_family returns A2's auth_user_id (the
--   sole remaining parent), the ENTIRE family A (family row, profiles, kid,
--   wallet, reward, purchase) is gone via CASCADE, and family B is fully intact
--   (cross-family isolation). Proves the reward_purchases -> rewards RESTRICT FK
--   does not block the cascade.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"a2222222-aaaa-1111-1111-111111111111"}';
insert into _ret (label, val) select 'delete_a', u from delete_family() as t(u);
reset role;
select set_config('request.jwt.claims', NULL, true);

do $$
declare
  v_uids uuid[];
  n int;
begin
  select array_agg(val order by val) into v_uids from _ret where label = 'delete_a';

  -- Only A2 remains as a parent in family A at this point, so exactly one uid.
  if v_uids is null or array_length(v_uids, 1) <> 1 then
    raise exception 'FAIL: delete_family returned % parent uids, expected 1', coalesce(array_length(v_uids, 1), 0);
  end if;
  if v_uids[1] <> 'a2222222-aaaa-1111-1111-111111111111' then
    raise exception 'FAIL: delete_family returned wrong parent uid, got %', v_uids[1];
  end if;

  -- Family A and everything keyed to it is gone.
  select count(*) into n from families where id = '11111111-aaaa-1111-1111-111111111111';
  if n <> 0 then raise exception 'FAIL: family A still present after delete_family (%)', n; end if;
  select count(*) into n from profiles where family_id = '11111111-aaaa-1111-1111-111111111111';
  if n <> 0 then raise exception 'FAIL: family A profiles survived cascade (%)', n; end if;
  select count(*) into n from wallets where family_id = '11111111-aaaa-1111-1111-111111111111';
  if n <> 0 then raise exception 'FAIL: family A wallets survived cascade (%)', n; end if;
  select count(*) into n from rewards where family_id = '11111111-aaaa-1111-1111-111111111111';
  if n <> 0 then raise exception 'FAIL: family A rewards survived cascade (%)', n; end if;
  select count(*) into n from reward_purchases where family_id = '11111111-aaaa-1111-1111-111111111111';
  if n <> 0 then raise exception 'FAIL: family A purchases survived cascade (%)', n; end if;

  -- Family B fully intact: family row + both profiles + the kid's wallet.
  select count(*) into n from families where id = '22222222-bbbb-2222-2222-222222222222';
  if n <> 1 then raise exception 'FAIL: family B removed by deleting family A (%)', n; end if;
  select count(*) into n from profiles where family_id = '22222222-bbbb-2222-2222-222222222222';
  if n <> 2 then raise exception 'FAIL: family B profiles affected (%)', n; end if;
  select count(*) into n from wallets where family_id = '22222222-bbbb-2222-2222-222222222222';
  if n <> 1 then raise exception 'FAIL: family B kid wallet affected (%)', n; end if;

  raise notice 'PASS: delete_family wipes ONLY the caller''s family (incl. RESTRICT-FK purchase); returns parent auth_user_ids; other family intact';
end $$;


do $$ begin raise notice '======== ALL TESTS PASSED ========'; end $$;

rollback;
