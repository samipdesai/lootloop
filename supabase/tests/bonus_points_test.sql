-- LootLoop integration test (task #21): award_bonus_points atomic RPC.
--
-- Runs against the LOCAL Supabase Postgres (after `supabase db reset`). Plain
-- SQL + assertions — no pgTAP. Deterministic: seeds fixed UUIDs, runs inside ONE
-- transaction that ROLLBACKs at the end, so the DB is untouched and re-runnable.
--
-- HOW TO RUN:
--   supabase db reset        # apply 001->006 fresh
--   docker exec -i supabase_db_Lootloop psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f - < supabase/tests/bonus_points_test.sql
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

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Fixed UUIDs: two families (A, B), each with a parent + a kid. Kid wallets are
-- auto-created by the 003 trigger.
-- ---------------------------------------------------------------------------
\set famA  '11111111-aaaa-1111-1111-111111111111'
\set famB  '22222222-bbbb-2222-2222-222222222222'

\set authParentA '1a111111-aaaa-1111-1111-111111111111'
\set authParentB '2a222222-bbbb-2222-2222-222222222222'

\set parentA '1b111111-aaaa-1111-1111-111111111111'
\set parentB '2b222222-bbbb-2222-2222-222222222222'

\set kidA '1c111111-aaaa-1111-1111-111111111111'
\set kidB '2c222222-bbbb-2222-2222-222222222222'

insert into auth.users (id, instance_id, aud, role, email)
  values (:'authParentA', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pa-bonus@example.com'),
         (:'authParentB', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pb-bonus@example.com');

insert into families (id, name) values (:'famA', 'Family A'), (:'famB', 'Family B');

insert into profiles (id, family_id, role, display_name, auth_user_id)
  values (:'parentA', :'famA', 'parent', 'Parent A', :'authParentA'),
         (:'parentB', :'famB', 'parent', 'Parent B', :'authParentB');

insert into profiles (id, family_id, role, display_name, pin_hash, age_mode)
  values (:'kidA', :'famA', 'kid', 'Kid A', 'hashA', 'detailed'),
         (:'kidB', :'famB', 'kid', 'Kid B', 'hashB', 'detailed');

-- Sanity: the 003 trigger bootstrapped both kids' wallets at balance 0.
do $$
declare n int;
begin
  select count(*) into n from wallets where kid_id in
    ('1c111111-aaaa-1111-1111-111111111111','2c222222-bbbb-2222-2222-222222222222')
    and wallet_balance = 0;
  if n <> 2 then raise exception 'FAIL: expected 2 zero-balance wallets, got %', n; end if;
  raise notice 'PASS: kid wallets bootstrapped at balance 0';
end $$;


-- ===========================================================================
-- SECTION 1 — POSITIVE: parent A awards a bonus → wallet +amount AND a bonus
-- ledger row (positive amount, note, awarded_by) is written.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"1a111111-aaaa-1111-1111-111111111111"}';
do $$
declare
  v_txn uuid; bal int;
  v_type point_txn_type; v_amount int; v_note text; v_by uuid; v_fam uuid; v_kid uuid;
begin
  v_txn := award_bonus_points('1c111111-aaaa-1111-1111-111111111111', 25,
                              'Great week!', '1b111111-aaaa-1111-1111-111111111111');
  if v_txn is null then raise exception 'FAIL: award_bonus_points returned null'; end if;

  select wallet_balance into bal from wallets where kid_id = '1c111111-aaaa-1111-1111-111111111111';
  if bal <> 25 then raise exception 'FAIL: expected balance 25 after bonus, got %', bal; end if;

  select type, amount, note, awarded_by, family_id, kid_id
    into v_type, v_amount, v_note, v_by, v_fam, v_kid
    from point_transactions where id = v_txn;
  if v_type <> 'bonus' then raise exception 'FAIL: ledger type not bonus, got %', v_type; end if;
  if v_amount <> 25 then raise exception 'FAIL: ledger amount not +25, got %', v_amount; end if;
  if v_note <> 'Great week!' then raise exception 'FAIL: note not stored, got %', v_note; end if;
  if v_by <> '1b111111-aaaa-1111-1111-111111111111' then
    raise exception 'FAIL: awarded_by not the parent, got %', v_by; end if;
  if v_fam <> '11111111-aaaa-1111-1111-111111111111' then
    raise exception 'FAIL: ledger family_id wrong, got %', v_fam; end if;
  if v_kid <> '1c111111-aaaa-1111-1111-111111111111' then
    raise exception 'FAIL: ledger kid_id wrong, got %', v_kid; end if;

  -- A second award stacks (wallet 25 -> 35); null note is allowed.
  perform award_bonus_points('1c111111-aaaa-1111-1111-111111111111', 10,
                             null, '1b111111-aaaa-1111-1111-111111111111');
  select wallet_balance into bal from wallets where kid_id = '1c111111-aaaa-1111-1111-111111111111';
  if bal <> 35 then raise exception 'FAIL: expected balance 35 after 2nd bonus, got %', bal; end if;

  raise notice 'PASS: parent awards bonus -> wallet +amount + bonus ledger row (note/awarded_by); null note allowed';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION 2 — AUTHZ: a KID session is rejected — including awarding to itself.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"11111111-aaaa-1111-1111-111111111111","profile_id":"1c111111-aaaa-1111-1111-111111111111"}';
do $$
declare bal int;
begin
  begin
    perform award_bonus_points('1c111111-aaaa-1111-1111-111111111111', 1000,
                               'self-reward', '1c111111-aaaa-1111-1111-111111111111');
    raise exception 'FAIL: kid awarded a bonus to themselves';
  exception when insufficient_privilege then null;
  end;

  -- Balance unchanged (still 35 from section 1).
  select wallet_balance into bal from wallets where kid_id = '1c111111-aaaa-1111-1111-111111111111';
  if bal <> 35 then raise exception 'FAIL: kid self-award changed balance to %', bal; end if;

  raise notice 'PASS: a kid CANNOT award bonus points (incl. to themselves)';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION 3 — ISOLATION: a different family's parent (B) is rejected.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"2a222222-bbbb-2222-2222-222222222222"}';
do $$
declare bal int;
begin
  begin
    perform award_bonus_points('1c111111-aaaa-1111-1111-111111111111', 500,
                               'cross-family', '2b222222-bbbb-2222-2222-222222222222');
    raise exception 'FAIL: parent B awarded a bonus to family A kid';
  exception when insufficient_privilege then null;
  end;

  -- Family A kid balance unchanged (still 35).
  select wallet_balance into bal from wallets where kid_id = '1c111111-aaaa-1111-1111-111111111111';
  if bal <> 35 then raise exception 'FAIL: cross-family award changed balance to %', bal; end if;

  raise notice 'PASS: a different family''s parent CANNOT award (family isolation)';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION 4 — VALIDATION: amount <= 0 (and null) is rejected.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"1a111111-aaaa-1111-1111-111111111111"}';
do $$
declare bal int;
begin
  begin
    perform award_bonus_points('1c111111-aaaa-1111-1111-111111111111', 0,
                               'zero', '1b111111-aaaa-1111-1111-111111111111');
    raise exception 'FAIL: zero-amount bonus accepted';
  exception when check_violation then null;
  end;
  begin
    perform award_bonus_points('1c111111-aaaa-1111-1111-111111111111', -5,
                               'negative', '1b111111-aaaa-1111-1111-111111111111');
    raise exception 'FAIL: negative bonus accepted';
  exception when check_violation then null;
  end;
  begin
    perform award_bonus_points('1c111111-aaaa-1111-1111-111111111111', null,
                               'null', '1b111111-aaaa-1111-1111-111111111111');
    raise exception 'FAIL: null bonus accepted';
  exception when check_violation then null;
  end;

  -- Balance untouched by any rejected award (still 35).
  select wallet_balance into bal from wallets where kid_id = '1c111111-aaaa-1111-1111-111111111111';
  if bal <> 35 then raise exception 'FAIL: rejected award changed balance to %', bal; end if;

  raise notice 'PASS: award_bonus_points rejects non-positive (incl. null) amounts';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


do $$ begin raise notice '======== ALL TESTS PASSED ========'; end $$;

rollback;
