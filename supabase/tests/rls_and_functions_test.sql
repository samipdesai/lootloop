-- LootLoop integration tests (task #6): RLS family isolation + atomic functions.
--
-- Runs against the LOCAL Supabase Postgres (after `supabase db reset`). Plain
-- SQL + assertions — no pgTAP dependency. Deterministic: seeds fixed UUIDs,
-- runs everything inside ONE transaction that ROLLBACKs at the end, so the DB
-- is untouched and the script can be re-run repeatedly.
--
-- HOW TO RUN:
--   supabase db reset        # apply 001->002->003 fresh
--   docker exec -i supabase_db_Lootloop psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f - < supabase/tests/rls_and_functions_test.sql
--   (or pipe the file in via stdin as above)
--
-- A passing run prints a series of "PASS:" NOTICEs and ends with
-- "ALL TESTS PASSED". Any failed assertion aborts with an exception.
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
-- Fixed UUIDs for two families (A and B), their parents and kids.
-- ---------------------------------------------------------------------------
\set famA  '11111111-1111-1111-1111-111111111111'
\set famB  '22222222-2222-2222-2222-222222222222'

\set authParentA '1a111111-1111-1111-1111-111111111111'
\set authParentB '2a222222-2222-2222-2222-222222222222'

\set parentA '1b111111-1111-1111-1111-111111111111'
\set parentB '2b222222-2222-2222-2222-222222222222'

\set kidA '1c111111-1111-1111-1111-111111111111'
\set kidA2 '1d111111-1111-1111-1111-111111111111'
\set kidB '2c222222-2222-2222-2222-222222222222'

-- ---------------------------------------------------------------------------
-- Seed (as superuser / table owner — bypasses RLS). The kid-wallet trigger
-- (003) auto-creates wallets + reading_streaks for each kid.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email)
  values (:'authParentA', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pa@example.com'),
         (:'authParentB', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pb@example.com');

insert into families (id, name) values (:'famA', 'Family A'), (:'famB', 'Family B');

insert into profiles (id, family_id, role, display_name, auth_user_id)
  values (:'parentA', :'famA', 'parent', 'Parent A', :'authParentA'),
         (:'parentB', :'famB', 'parent', 'Parent B', :'authParentB');

insert into profiles (id, family_id, role, display_name, pin_hash, age_mode)
  values (:'kidA',  :'famA', 'kid', 'Kid A',  'hashA',  'detailed'),
         (:'kidA2', :'famA', 'kid', 'Kid A2', 'hashA2', 'detailed'),
         (:'kidB',  :'famB', 'kid', 'Kid B',  'hashB',  'detailed');

-- Catalog + chore in each family for isolation/atomic tests.
\set rewardA 'aa111111-1111-1111-1111-111111111111'
\set rewardB 'bb222222-2222-2222-2222-222222222222'
insert into rewards (id, family_id, title, cost)
  values (:'rewardA', :'famA', 'Ice cream', 50),
         (:'rewardB', :'famB', 'Movie',     50);

\set choreA  'ca111111-1111-1111-1111-111111111111'
\set instA   'cb111111-1111-1111-1111-111111111111'
\set compA   'cc111111-1111-1111-1111-111111111111'
insert into chores (id, family_id, title, points, assignment, assigned_kid_id)
  values (:'choreA', :'famA', 'Dishes', 30, 'assigned', :'kidA');
insert into chore_instances (id, family_id, chore_id, due_date, points)
  values (:'instA', :'famA', :'choreA', current_date, 30);
insert into chore_completions (id, family_id, chore_instance_id, kid_id, status)
  values (:'compA', :'famA', :'instA', :'kidA', 'pending');

-- Confirm the trigger bootstrapped wallets for both kids.
do $$
declare n int;
begin
  select count(*) into n from wallets where kid_id in
    ('1c111111-1111-1111-1111-111111111111','2c222222-2222-2222-2222-222222222222');
  if n <> 2 then raise exception 'FAIL: expected 2 auto-created wallets, got %', n; end if;
  select count(*) into n from reading_streaks where kid_id in
    ('1c111111-1111-1111-1111-111111111111','2c222222-2222-2222-2222-222222222222');
  if n <> 2 then raise exception 'FAIL: expected 2 auto-created streaks, got %', n; end if;
  raise notice 'PASS: kid wallet+streak bootstrap trigger';
end $$;


-- ===========================================================================
-- SECTION 1 — Helper resolution sanity (parent vs kid sessions).
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"1a111111-1111-1111-1111-111111111111"}';
do $$
begin
  if auth_family_id() <> '11111111-1111-1111-1111-111111111111' then
    raise exception 'FAIL: parent A family_id resolution'; end if;
  if auth_role() <> 'parent' then raise exception 'FAIL: parent A role'; end if;
  if auth_is_kid() then raise exception 'FAIL: parent flagged as kid'; end if;
  raise notice 'PASS: parent session resolves family/role via auth.uid()';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"11111111-1111-1111-1111-111111111111","profile_id":"1c111111-1111-1111-1111-111111111111"}';
do $$
begin
  if auth_family_id() <> '11111111-1111-1111-1111-111111111111' then
    raise exception 'FAIL: kid A family_id resolution'; end if;
  if auth_role() <> 'kid' then raise exception 'FAIL: kid A role'; end if;
  if not auth_is_kid() then raise exception 'FAIL: kid not flagged as kid'; end if;
  if auth_profile_id() <> '1c111111-1111-1111-1111-111111111111' then
    raise exception 'FAIL: kid A profile_id resolution'; end if;
  raise notice 'PASS: kid session resolves family/role/profile via JWT claims';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION 2 — Cross-family isolation: PARENT A cannot see/touch family B.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"1a111111-1111-1111-1111-111111111111"}';
do $$
declare n int;
begin
  -- SELECT: sees only family A rows.
  select count(*) into n from families;
  if n <> 1 then raise exception 'FAIL: parent A sees % families (want 1)', n; end if;
  select count(*) into n from profiles;
  if n <> 3 then raise exception 'FAIL: parent A sees % profiles (want 3: parent + 2 kids)', n; end if;
  select count(*) into n from rewards;
  if n <> 1 then raise exception 'FAIL: parent A sees % rewards (want 1)', n; end if;
  select count(*) into n from rewards where id = 'bb222222-2222-2222-2222-222222222222';
  if n <> 0 then raise exception 'FAIL: parent A can SELECT family B reward'; end if;

  -- UPDATE family B reward: 0 rows affected (invisible to the policy).
  update rewards set title = 'hacked' where id = 'bb222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: parent A UPDATEd % family B reward rows', n; end if;

  -- DELETE family B reward: 0 rows affected.
  delete from rewards where id = 'bb222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: parent A DELETEd % family B reward rows', n; end if;

  raise notice 'PASS: parent A isolated from family B (select/update/delete)';
end $$;

-- INSERT into family B must be rejected by WITH CHECK.
do $$
begin
  insert into rewards (family_id, title, cost)
    values ('22222222-2222-2222-2222-222222222222', 'cross-insert', 10);
  raise exception 'FAIL: parent A INSERTed a reward into family B';
exception when insufficient_privilege then
  raise notice 'PASS: parent A INSERT into family B rejected (RLS WITH CHECK)';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION 3 — Cross-family isolation: KID A cannot see/touch family B,
-- and cannot directly write balances/ledgers in its OWN family.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"11111111-1111-1111-1111-111111111111","profile_id":"1c111111-1111-1111-1111-111111111111"}';
do $$
declare n int;
begin
  -- Kid sees only its own family's catalog.
  select count(*) into n from rewards;
  if n <> 1 then raise exception 'FAIL: kid A sees % rewards (want 1)', n; end if;
  select count(*) into n from rewards where id = 'bb222222-2222-2222-2222-222222222222';
  if n <> 0 then raise exception 'FAIL: kid A can SELECT family B reward'; end if;

  -- Kid sees its own wallet, not kid B's.
  select count(*) into n from wallets;
  if n <> 1 then raise exception 'FAIL: kid A sees % wallets (want only its own)', n; end if;
  select count(*) into n from wallets where kid_id = '2c222222-2222-2222-2222-222222222222';
  if n <> 0 then raise exception 'FAIL: kid A can SELECT kid B wallet'; end if;

  -- Kid cannot delete family B reward (kid has no delete grant either, but the
  -- isolation point is it's invisible — assert via select already done above).
  delete from rewards where id = 'bb222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: kid A DELETEd family B reward'; end if;

  raise notice 'PASS: kid A isolated from family B (select/delete)';
end $$;

-- Kid cannot UPDATE its own wallet balance directly: no UPDATE privilege on
-- wallets is granted to authenticated, so the write is denied outright.
do $$
begin
  update wallets set wallet_balance = 9999 where kid_id = '1c111111-1111-1111-1111-111111111111';
  raise exception 'FAIL: kid A directly UPDATEd its wallet';
exception when insufficient_privilege then
  raise notice 'PASS: kid A cannot directly write its wallet balance (no privilege)';
end $$;

-- Kid A cannot INSERT a point_transactions ledger row (no INSERT policy → denied).
do $$
begin
  insert into point_transactions (family_id, kid_id, type, amount)
    values ('11111111-1111-1111-1111-111111111111', '1c111111-1111-1111-1111-111111111111', 'earn', 1000);
  raise exception 'FAIL: kid A directly INSERTed a point_transactions row';
exception when insufficient_privilege then
  raise notice 'PASS: kid A direct ledger INSERT rejected (RLS)';
end $$;

-- Kid A cannot insert a completion claiming to be kid B (kid_id mismatch).
do $$
begin
  insert into chore_completions (family_id, chore_instance_id, kid_id, status)
    values ('11111111-1111-1111-1111-111111111111', 'cb111111-1111-1111-1111-111111111111',
            '2c222222-2222-2222-2222-222222222222', 'pending');
  raise exception 'FAIL: kid A inserted a completion as kid B';
exception when insufficient_privilege then
  raise notice 'PASS: kid A cannot insert completion impersonating another kid';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION 4 — award_points_on_approval: AUTHZ + correctness + idempotency.
-- The functions now gate the CALLER in-body, so positive paths run inside the
-- correct session (parent for approval; owning kid for purchase/transfer).
-- ===========================================================================

-- 4a. ADVERSARIAL: a kid approving their OWN pending completion must be denied
--     (a kid is never allowed to approve anything).
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"11111111-1111-1111-1111-111111111111","profile_id":"1c111111-1111-1111-1111-111111111111"}';
do $$
begin
  perform award_points_on_approval('cc111111-1111-1111-1111-111111111111',
                                   '1c111111-1111-1111-1111-111111111111');
  raise exception 'FAIL: kid approved their own completion';
exception when insufficient_privilege then
  raise notice 'PASS: kid CANNOT approve their own completion (authz)';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

-- 4b. POSITIVE: parent A approves → +30, one earn row, idempotent on re-approve.
set local role authenticated;
set local request.jwt.claims = '{"sub":"1a111111-1111-1111-1111-111111111111"}';
do $$
declare
  txn1 uuid; txn2 uuid; bal int; ledger_count int;
begin
  txn1 := award_points_on_approval('cc111111-1111-1111-1111-111111111111',
                                   '1b111111-1111-1111-1111-111111111111');
  select wallet_balance into bal from wallets where kid_id = '1c111111-1111-1111-1111-111111111111';
  if bal <> 30 then raise exception 'FAIL: expected balance 30 after approval, got %', bal; end if;

  -- Re-approve (idempotent): same ledger txn id, balance unchanged, no 2nd row.
  txn2 := award_points_on_approval('cc111111-1111-1111-1111-111111111111',
                                   '1b111111-1111-1111-1111-111111111111');
  if txn1 <> txn2 then raise exception 'FAIL: re-approval returned a different txn id'; end if;
  select wallet_balance into bal from wallets where kid_id = '1c111111-1111-1111-1111-111111111111';
  if bal <> 30 then raise exception 'FAIL: balance changed on re-approval, got %', bal; end if;
  select count(*) into ledger_count from point_transactions
    where chore_completion_id = 'cc111111-1111-1111-1111-111111111111' and type = 'earn';
  if ledger_count <> 1 then raise exception 'FAIL: expected 1 earn row, got % (double-award!)', ledger_count; end if;

  raise notice 'PASS: parent approves once + idempotent on re-approval';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION 5 — purchase_reward: AUTHZ + success + insufficient funds.
-- ===========================================================================

-- 5a. ADVERSARIAL: another kid in the SAME family (kid A2) cannot buy on behalf
--     of kid A — caller must be that kid or a parent. Denied before any funds
--     logic. (kid A2 session)
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"11111111-1111-1111-1111-111111111111","profile_id":"1d111111-1111-1111-1111-111111111111"}';
do $$
begin
  perform purchase_reward('aa111111-1111-1111-1111-111111111111',
                          '1c111111-1111-1111-1111-111111111111');  -- buying for kid A
  raise exception 'FAIL: kid A2 purchased on behalf of kid A';
exception when insufficient_privilege then
  raise notice 'PASS: another kid CANNOT purchase on behalf of a different kid (same family)';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

-- 5b. ADVERSARIAL: cross-family — kid B buying using kid A's wallet → denied at
--     the caller gate (caller family <> wallet family). (kid B session)
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"22222222-2222-2222-2222-222222222222","profile_id":"2c222222-2222-2222-2222-222222222222"}';
do $$
begin
  perform purchase_reward('aa111111-1111-1111-1111-111111111111',
                          '1c111111-1111-1111-1111-111111111111');
  raise exception 'FAIL: kid B purchased using kid A wallet';
exception when insufficient_privilege then
  raise notice 'PASS: cross-family purchase denied at caller gate';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

-- 5c. POSITIVE + funds checks: the OWNING kid (kid A) buys their own reward.
--     Insufficient funds first (balance 30 < cost 50), then top up + succeed.
--     Privileged top-up runs as superuser (test setup); the purchase runs in
--     the kid A session (code path under test).
update wallets set wallet_balance = 80 where kid_id = '1c111111-1111-1111-1111-111111111111';

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"11111111-1111-1111-1111-111111111111","profile_id":"1c111111-1111-1111-1111-111111111111"}';
do $$
declare purchase uuid; bal int;
begin
  -- Cross-family reward (family B) → caller-family vs reward-family mismatch:
  -- still rejected (defense-in-depth family check), as insufficient_privilege?
  -- No — that check raises check_violation; assert it stays rejected.
  begin
    purchase := purchase_reward('bb222222-2222-2222-2222-222222222222',
                                '1c111111-1111-1111-1111-111111111111');
    raise exception 'FAIL: kid A purchased family B reward';
  exception when check_violation then
    raise notice 'PASS: buying a different family''s reward rejected';
  end;
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

-- Reset kid A to a known insufficient balance to test the funds path cleanly.
update wallets set wallet_balance = 30 where kid_id = '1c111111-1111-1111-1111-111111111111';

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"11111111-1111-1111-1111-111111111111","profile_id":"1c111111-1111-1111-1111-111111111111"}';
do $$
declare purchase uuid; bal int;
begin
  -- Kid A has 30; reward costs 50 → insufficient funds.
  begin
    purchase := purchase_reward('aa111111-1111-1111-1111-111111111111',
                                '1c111111-1111-1111-1111-111111111111');
    raise exception 'FAIL: purchase succeeded with insufficient funds';
  exception when check_violation then
    raise notice 'PASS: purchase rejected on insufficient funds';
  end;
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

-- Top kid A up to 80 (privileged setup), then buy as kid A → balance 30.
update wallets set wallet_balance = 80 where kid_id = '1c111111-1111-1111-1111-111111111111';

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"11111111-1111-1111-1111-111111111111","profile_id":"1c111111-1111-1111-1111-111111111111"}';
do $$
declare purchase uuid; bal int;
begin
  purchase := purchase_reward('aa111111-1111-1111-1111-111111111111',
                              '1c111111-1111-1111-1111-111111111111');
  select wallet_balance into bal from wallets where kid_id = '1c111111-1111-1111-1111-111111111111';
  if bal <> 30 then raise exception 'FAIL: expected 80-50=30 after purchase, got %', bal; end if;

  if (select cost from reward_purchases where id = purchase) <> 50 then
    raise exception 'FAIL: purchase cost snapshot wrong'; end if;
  if (select status from reward_purchases where id = purchase) <> 'purchased' then
    raise exception 'FAIL: purchase status not purchased'; end if;
  if (select point_transaction_id from reward_purchases where id = purchase) is null then
    raise exception 'FAIL: purchase not linked to spend ledger row'; end if;
  if (select amount from point_transactions
        where id = (select point_transaction_id from reward_purchases where id = purchase)) <> -50 then
    raise exception 'FAIL: spend ledger amount should be -50'; end if;

  raise notice 'PASS: owning kid purchases own reward — deducts balance, snapshots cost, links ledger';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION 6 — transfer_to_savings: AUTHZ + deposit/withdraw + overdrafts.
-- ===========================================================================

-- 6a. ADVERSARIAL: kid A trying to move kid B's points → denied at caller gate
--     (caller family <> wallet family, and caller is not that kid/parent).
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"11111111-1111-1111-1111-111111111111","profile_id":"1c111111-1111-1111-1111-111111111111"}';
do $$
begin
  perform transfer_to_savings('2c222222-2222-2222-2222-222222222222', 5, 'deposit');
  raise exception 'FAIL: kid A moved kid B savings';
exception when insufficient_privilege then
  raise notice 'PASS: kid A CANNOT transfer another kid''s points (authz)';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

-- 6b. POSITIVE + overdraft/validation: the owning kid (kid A) moves own points.
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"11111111-1111-1111-1111-111111111111","profile_id":"1c111111-1111-1111-1111-111111111111"}';
do $$
declare wbal int; sbal int; t uuid;
begin
  -- Kid A currently: wallet 30, savings 0.
  -- Deposit 20 -> wallet 10, savings 20.
  t := transfer_to_savings('1c111111-1111-1111-1111-111111111111', 20, 'deposit');
  select wallet_balance, savings_balance into wbal, sbal
    from wallets where kid_id = '1c111111-1111-1111-1111-111111111111';
  if wbal <> 10 or sbal <> 20 then
    raise exception 'FAIL: after deposit expected (10,20) got (%,%)', wbal, sbal; end if;
  if (select amount from savings_transactions where id = t) <> 20 then
    raise exception 'FAIL: deposit ledger amount should be +20'; end if;

  -- Withdraw 5 -> wallet 15, savings 15.
  t := transfer_to_savings('1c111111-1111-1111-1111-111111111111', 5, 'withdraw');
  select wallet_balance, savings_balance into wbal, sbal
    from wallets where kid_id = '1c111111-1111-1111-1111-111111111111';
  if wbal <> 15 or sbal <> 15 then
    raise exception 'FAIL: after withdraw expected (15,15) got (%,%)', wbal, sbal; end if;
  if (select amount from savings_transactions where id = t) <> -5 then
    raise exception 'FAIL: withdraw ledger amount should be -5'; end if;

  raise notice 'PASS: owning kid transfers own points (deposit + withdraw) + ledger';

  -- Overdraft deposit (wallet 15, try 1000) rejected.
  begin
    perform transfer_to_savings('1c111111-1111-1111-1111-111111111111', 1000, 'deposit');
    raise exception 'FAIL: overdraft deposit allowed';
  exception when check_violation then
    raise notice 'PASS: overdraft deposit rejected';
  end;

  -- Overdraft withdraw (savings 15, try 1000) rejected.
  begin
    perform transfer_to_savings('1c111111-1111-1111-1111-111111111111', 1000, 'withdraw');
    raise exception 'FAIL: overdraft withdraw allowed';
  exception when check_violation then
    raise notice 'PASS: overdraft withdraw rejected';
  end;

  -- Non-positive amount rejected.
  begin
    perform transfer_to_savings('1c111111-1111-1111-1111-111111111111', 0, 'deposit');
    raise exception 'FAIL: zero-amount transfer allowed';
  exception when check_violation then
    raise notice 'PASS: non-positive transfer rejected';
  end;
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION 7 — credit_interest: service-role-only seam.
-- ===========================================================================

-- 7a. ADVERSARIAL: an authenticated KID cannot execute credit_interest at all —
--     EXECUTE is not granted to authenticated (only service_role/postgres). The
--     call fails at permission-check time, before any function body runs.
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"11111111-1111-1111-1111-111111111111","profile_id":"1c111111-1111-1111-1111-111111111111"}';
do $$
begin
  perform credit_interest('1c111111-1111-1111-1111-111111111111', 1000000);
  raise exception 'FAIL: kid executed credit_interest';
exception when insufficient_privilege then
  raise notice 'PASS: kid CANNOT execute credit_interest (not granted to authenticated)';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

-- 7b. POSITIVE: the cron seam (service_role / postgres) credits interest. Run as
--     the superuser context here, standing in for the interest Edge Function's
--     service role.
do $$
declare sbal0 int; sbal1 int; t uuid;
begin
  select savings_balance into sbal0 from wallets where kid_id = '1c111111-1111-1111-1111-111111111111';
  t := credit_interest('1c111111-1111-1111-1111-111111111111', 3);
  select savings_balance into sbal1 from wallets where kid_id = '1c111111-1111-1111-1111-111111111111';
  if sbal1 <> sbal0 + 3 then raise exception 'FAIL: interest not credited, % -> %', sbal0, sbal1; end if;
  if (select type from savings_transactions where id = t) <> 'interest' then
    raise exception 'FAIL: interest ledger type wrong'; end if;
  raise notice 'PASS: service role credits interest + writes interest ledger row';
end $$;


do $$ begin raise notice '======== ALL TESTS PASSED ========'; end $$;

rollback;
