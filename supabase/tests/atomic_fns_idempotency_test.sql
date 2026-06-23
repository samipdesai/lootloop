-- LootLoop integration test (task #45): idempotency + edge cases for the four
-- atomic SECURITY DEFINER functions, covering cases NOT already proven in
-- rls_and_functions_test.sql:
--
--   award_points_on_approval — re-approval no-op (already approved) returns the
--     SAME ledger id and does not double-award; cannot approve a REJECTED
--     completion; cannot approve a non-existent completion.
--   purchase_reward          — inactive reward rejected; cross-family reward
--     rejected; exact wallet-underflow boundary (balance == cost succeeds;
--     balance == cost-1 fails).
--   transfer_to_savings      — deposit & withdraw overdraft guards; invalid
--     direction ('interest') rejected; non-positive (0 and negative) rejected.
--   credit_interest          — service-role-only (authenticated kid AND parent
--     both denied at EXECUTE); re-run on the same kid is additive (each call
--     credits again + writes another ledger row — it is intentionally NOT
--     idempotent, it's a periodic accrual).
--
-- Plain SQL + assertions, no pgTAP. Deterministic: fixed UUIDs, ONE transaction
-- that ROLLBACKs, re-runnable.
--
-- HOW TO RUN:
--   docker exec -i supabase_db_Lootloop psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f - < supabase/tests/atomic_fns_idempotency_test.sql

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Fixed UUIDs: two families. Family A has a parent + two kids; family B a parent
-- + a kid (for the cross-family reward check). Kid wallets auto-created by 003.
-- ---------------------------------------------------------------------------
\set famA  '11111111-eeee-1111-1111-111111111111'
\set famB  '22222222-ffff-2222-2222-222222222222'

\set authParentA '1a111111-eeee-1111-1111-111111111111'
\set authParentB '2a222222-ffff-2222-2222-222222222222'

\set parentA '1b111111-eeee-1111-1111-111111111111'
\set parentB '2b222222-ffff-2222-2222-222222222222'

\set kidA  '1c111111-eeee-1111-1111-111111111111'
\set kidA2 '1d111111-eeee-1111-1111-111111111111'
\set kidB  '2c222222-ffff-2222-2222-222222222222'

insert into auth.users (id, instance_id, aud, role, email)
  values (:'authParentA', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pa-idem@example.com'),
         (:'authParentB', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pb-idem@example.com');

insert into families (id, name) values (:'famA', 'Family A'), (:'famB', 'Family B');

insert into profiles (id, family_id, role, display_name, auth_user_id)
  values (:'parentA', :'famA', 'parent', 'Parent A', :'authParentA'),
         (:'parentB', :'famB', 'parent', 'Parent B', :'authParentB');

insert into profiles (id, family_id, role, display_name, pin_hash, age_mode)
  values (:'kidA',  :'famA', 'kid', 'Kid A',  'hashA',  'detailed'),
         (:'kidA2', :'famA', 'kid', 'Kid A2', 'hashA2', 'detailed'),
         (:'kidB',  :'famB', 'kid', 'Kid B',  'hashB',  'detailed');

-- Rewards: an ACTIVE and an INACTIVE one in family A; one in family B.
\set rewardActiveA   'aa111111-eeee-1111-1111-111111111111'
\set rewardInactiveA 'ab111111-eeee-1111-1111-111111111111'
\set rewardB         'bb222222-ffff-2222-2222-222222222222'
insert into rewards (id, family_id, title, cost, active)
  values (:'rewardActiveA',   :'famA', 'Active reward',   50, true),
         (:'rewardInactiveA', :'famA', 'Retired reward',  50, false),
         (:'rewardB',         :'famB', 'Family B reward', 50, true);

-- A chore + instance + completion (pending) in family A, plus a SECOND completion
-- (for kid A2) we will reject, to test "cannot approve a rejected completion".
\set choreA  'ca111111-eeee-1111-1111-111111111111'
\set instA   'cb111111-eeee-1111-1111-111111111111'
\set instA2  'cb211111-eeee-1111-1111-111111111111'
\set compA   'cc111111-eeee-1111-1111-111111111111'
\set compRej 'cd111111-eeee-1111-1111-111111111111'
insert into chores (id, family_id, title, points, assignment)
  values (:'choreA', :'famA', 'Dishes', 30, 'shared');
insert into chore_instances (id, family_id, chore_id, due_date, points)
  values (:'instA',  :'famA', :'choreA', current_date, 30),
         (:'instA2', :'famA', :'choreA', current_date - 1, 30);
insert into chore_completions (id, family_id, chore_instance_id, kid_id, status)
  values (:'compA',   :'famA', :'instA',  :'kidA',  'pending'),
         (:'compRej', :'famA', :'instA2', :'kidA2', 'rejected');


-- ===========================================================================
-- SECTION 1 — award_points_on_approval edge cases.
-- ===========================================================================

-- 1a. Cannot approve a REJECTED completion (must be re-claimed first).
set local role authenticated;
set local request.jwt.claims = '{"sub":"1a111111-eeee-1111-1111-111111111111"}';
do $$
begin
  perform award_points_on_approval('cd111111-eeee-1111-1111-111111111111',
                                   '1b111111-eeee-1111-1111-111111111111');
  raise exception 'FAIL: approved a rejected completion';
exception when check_violation then
  raise notice 'PASS: cannot approve a rejected completion';
end $$;

-- 1b. Approving a NON-EXISTENT completion raises no_data_found.
do $$
begin
  perform award_points_on_approval('00000000-0000-4000-8000-000000000000',
                                   '1b111111-eeee-1111-1111-111111111111');
  raise exception 'FAIL: approved a non-existent completion';
exception when no_data_found then
  raise notice 'PASS: approving a non-existent completion raises no_data_found';
end $$;

-- 1c. Re-approval is a NO-OP: same ledger id, balance unchanged, exactly one
--     earn row (no double-award). Approve compA (pending) once, then twice more.
do $$
declare t1 uuid; t2 uuid; t3 uuid; bal int; earns int;
begin
  t1 := award_points_on_approval('cc111111-eeee-1111-1111-111111111111',
                                 '1b111111-eeee-1111-1111-111111111111');
  t2 := award_points_on_approval('cc111111-eeee-1111-1111-111111111111',
                                 '1b111111-eeee-1111-1111-111111111111');
  t3 := award_points_on_approval('cc111111-eeee-1111-1111-111111111111',
                                 '1b111111-eeee-1111-1111-111111111111');
  if t1 <> t2 or t2 <> t3 then
    raise exception 'FAIL: re-approval returned different ledger ids (% / % / %)', t1, t2, t3; end if;
  select wallet_balance into bal from wallets where kid_id = '1c111111-eeee-1111-1111-111111111111';
  if bal <> 30 then raise exception 'FAIL: balance % after 3 approvals (want 30, no double-award)', bal; end if;
  select count(*) into earns from point_transactions
    where chore_completion_id = 'cc111111-eeee-1111-1111-111111111111' and type = 'earn';
  if earns <> 1 then raise exception 'FAIL: % earn rows for one completion (double-award!)', earns; end if;
  raise notice 'PASS: re-approval is idempotent (same ledger id, single earn row, balance steady at 30)';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION 2 — purchase_reward edge cases.
-- ===========================================================================

-- Give kid A 50 points (exact cost) for the boundary tests.
update wallets set wallet_balance = 50 where kid_id = '1c111111-eeee-1111-1111-111111111111';

-- 2a. INACTIVE reward rejected even with sufficient funds.
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"11111111-eeee-1111-1111-111111111111","profile_id":"1c111111-eeee-1111-1111-111111111111"}';
do $$
begin
  perform purchase_reward('ab111111-eeee-1111-1111-111111111111',
                          '1c111111-eeee-1111-1111-111111111111');
  raise exception 'FAIL: purchased an inactive reward';
exception when check_violation then
  raise notice 'PASS: inactive reward purchase rejected';
end $$;

-- 2b. CROSS-FAMILY reward rejected (kid A buying family B's reward).
do $$
begin
  perform purchase_reward('bb222222-ffff-2222-2222-222222222222',
                          '1c111111-eeee-1111-1111-111111111111');
  raise exception 'FAIL: purchased a cross-family reward';
exception when check_violation then
  raise notice 'PASS: cross-family reward purchase rejected';
end $$;

-- 2c. UNDERFLOW BOUNDARY (just below): balance 49, cost 50 → rejected, and the
--     wallet is left untouched (no partial deduction).
reset role;
select set_config('request.jwt.claims', NULL, true);
update wallets set wallet_balance = 49 where kid_id = '1c111111-eeee-1111-1111-111111111111';
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"11111111-eeee-1111-1111-111111111111","profile_id":"1c111111-eeee-1111-1111-111111111111"}';
do $$
declare bal int;
begin
  begin
    perform purchase_reward('aa111111-eeee-1111-1111-111111111111',
                            '1c111111-eeee-1111-1111-111111111111');
    raise exception 'FAIL: purchase succeeded at balance 49 < cost 50';
  exception when check_violation then
    null;  -- expected
  end;
  select wallet_balance into bal from wallets where kid_id = '1c111111-eeee-1111-1111-111111111111';
  if bal <> 49 then raise exception 'FAIL: wallet changed after rejected purchase (now %)', bal; end if;
  raise notice 'PASS: underflow boundary balance=cost-1 rejected, wallet untouched';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

-- 2d. EXACT BOUNDARY (balance == cost): balance 50, cost 50 → succeeds, leaves 0.
update wallets set wallet_balance = 50 where kid_id = '1c111111-eeee-1111-1111-111111111111';
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"11111111-eeee-1111-1111-111111111111","profile_id":"1c111111-eeee-1111-1111-111111111111"}';
do $$
declare p uuid; bal int;
begin
  p := purchase_reward('aa111111-eeee-1111-1111-111111111111',
                       '1c111111-eeee-1111-1111-111111111111');
  select wallet_balance into bal from wallets where kid_id = '1c111111-eeee-1111-1111-111111111111';
  if bal <> 0 then raise exception 'FAIL: expected balance 0 after exact-cost purchase, got %', bal; end if;
  if (select amount from point_transactions
        where id = (select point_transaction_id from reward_purchases where id = p)) <> -50 then
    raise exception 'FAIL: spend ledger amount should be -50'; end if;
  raise notice 'PASS: exact-cost boundary balance=cost succeeds, leaves 0';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION 3 — transfer_to_savings edge cases.
-- ===========================================================================

-- Set kid A: wallet 10, savings 5 for the guard tests.
update wallets set wallet_balance = 10, savings_balance = 5
  where kid_id = '1c111111-eeee-1111-1111-111111111111';

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"11111111-eeee-1111-1111-111111111111","profile_id":"1c111111-eeee-1111-1111-111111111111"}';
do $$
declare wbal int; sbal int;
begin
  -- 3a. Deposit overdraft (wallet 10, deposit 11) rejected; balances unchanged.
  begin
    perform transfer_to_savings('1c111111-eeee-1111-1111-111111111111', 11, 'deposit');
    raise exception 'FAIL: deposit overdraft allowed (11 > wallet 10)';
  exception when check_violation then null; end;

  -- 3b. Withdraw overdraft (savings 5, withdraw 6) rejected.
  begin
    perform transfer_to_savings('1c111111-eeee-1111-1111-111111111111', 6, 'withdraw');
    raise exception 'FAIL: withdraw overdraft allowed (6 > savings 5)';
  exception when check_violation then null; end;

  -- 3c. INVALID DIRECTION: the enum has 'interest' but transfer only permits
  --     deposit/withdraw → invalid_parameter_value.
  begin
    perform transfer_to_savings('1c111111-eeee-1111-1111-111111111111', 1, 'interest');
    raise exception 'FAIL: invalid direction interest allowed';
  exception when invalid_parameter_value then null; end;

  -- 3d. NON-POSITIVE amount: 0 and negative both rejected.
  begin
    perform transfer_to_savings('1c111111-eeee-1111-1111-111111111111', 0, 'deposit');
    raise exception 'FAIL: zero-amount transfer allowed';
  exception when check_violation then null; end;
  begin
    perform transfer_to_savings('1c111111-eeee-1111-1111-111111111111', -5, 'deposit');
    raise exception 'FAIL: negative-amount transfer allowed';
  exception when check_violation then null; end;

  -- Balances unchanged after all the rejected attempts.
  select wallet_balance, savings_balance into wbal, sbal
    from wallets where kid_id = '1c111111-eeee-1111-1111-111111111111';
  if wbal <> 10 or sbal <> 5 then
    raise exception 'FAIL: balances drifted after rejected transfers: (%,%)', wbal, sbal; end if;

  raise notice 'PASS: transfer guards (deposit/withdraw overdraft, invalid direction, zero/negative) all reject + balances steady';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION 4 — credit_interest: service-role-only + additive on re-run.
-- ===========================================================================

-- 4a. Authenticated PARENT cannot execute credit_interest (not granted to
--     authenticated — only service_role/postgres). Denied at EXECUTE time.
set local role authenticated;
set local request.jwt.claims = '{"sub":"1a111111-eeee-1111-1111-111111111111"}';
do $$
begin
  perform credit_interest('1c111111-eeee-1111-1111-111111111111', 5);
  raise exception 'FAIL: parent executed credit_interest';
exception when insufficient_privilege then
  raise notice 'PASS: authenticated parent CANNOT execute credit_interest (service_role only)';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

-- 4b. Authenticated KID likewise cannot execute it.
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"11111111-eeee-1111-1111-111111111111","profile_id":"1c111111-eeee-1111-1111-111111111111"}';
do $$
begin
  perform credit_interest('1c111111-eeee-1111-1111-111111111111', 5);
  raise exception 'FAIL: kid executed credit_interest';
exception when insufficient_privilege then
  raise notice 'PASS: authenticated kid CANNOT execute credit_interest (service_role only)';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

-- 4c. Service-role seam (superuser context here) credits interest. Re-running is
--     ADDITIVE: each call accrues again and writes another interest ledger row
--     (it models periodic accrual, not an idempotent one-shot). Non-positive
--     amount is still rejected.
do $$
declare s0 int; s1 int; s2 int; rows int; t1 uuid; t2 uuid;
begin
  select savings_balance into s0 from wallets where kid_id = '1c111111-eeee-1111-1111-111111111111';
  t1 := credit_interest('1c111111-eeee-1111-1111-111111111111', 3);
  select savings_balance into s1 from wallets where kid_id = '1c111111-eeee-1111-1111-111111111111';
  if s1 <> s0 + 3 then raise exception 'FAIL: first interest credit % -> % (want +3)', s0, s1; end if;

  t2 := credit_interest('1c111111-eeee-1111-1111-111111111111', 3);
  select savings_balance into s2 from wallets where kid_id = '1c111111-eeee-1111-1111-111111111111';
  if s2 <> s1 + 3 then raise exception 'FAIL: second interest credit % -> % (want +3 again, additive)', s1, s2; end if;
  if t1 = t2 then raise exception 'FAIL: re-run returned the same ledger id (should be a new accrual row)'; end if;

  select count(*) into rows from savings_transactions
    where kid_id = '1c111111-eeee-1111-1111-111111111111' and type = 'interest';
  if rows <> 2 then raise exception 'FAIL: expected 2 interest ledger rows after two runs, got %', rows; end if;

  -- Non-positive interest rejected.
  begin
    perform credit_interest('1c111111-eeee-1111-1111-111111111111', 0);
    raise exception 'FAIL: zero interest allowed';
  exception when check_violation then null; end;

  raise notice 'PASS: service role credits interest; re-run is additive (2 rows, distinct ids); non-positive rejected';
end $$;


do $$ begin raise notice '======== ALL TESTS PASSED ========'; end $$;

rollback;
