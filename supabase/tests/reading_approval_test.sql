-- LootLoop integration test (tasks #28 / #29): approve_reading_log atomic RPC
-- (award points) + reading-streak advance/reset.
--
-- Runs against the LOCAL Supabase Postgres (after `supabase db reset`). Plain
-- SQL + assertions — no pgTAP. Deterministic: seeds fixed UUIDs, runs inside ONE
-- transaction that ROLLBACKs at the end, so the DB is untouched and re-runnable.
--
-- HOW TO RUN:
--   supabase db reset        # apply 001->007 fresh
--   docker exec -i supabase_db_Lootloop psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f - < supabase/tests/reading_approval_test.sql
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
-- Fixed UUIDs: two families (A, B), each with a parent + a kid. Kid wallets and
-- reading_streaks are auto-created by the 003 trigger.
-- ---------------------------------------------------------------------------
\set famA  '11111111-aaaa-1111-1111-111111111111'
\set famB  '22222222-bbbb-2222-2222-222222222222'

\set authParentA '1a111111-aaaa-1111-1111-111111111111'
\set authParentB '2a222222-bbbb-2222-2222-222222222222'

\set parentA '1b111111-aaaa-1111-1111-111111111111'
\set parentB '2b222222-bbbb-2222-2222-222222222222'

\set kidA '1c111111-aaaa-1111-1111-111111111111'
\set kidB '2c222222-bbbb-2222-2222-222222222222'

-- Reading logs in family A (one per scenario day). read_on is set explicitly so
-- streak transitions (consecutive / gap / backdated) are deterministic.
--   log1 -> 2026-06-01 (day 0), log2 -> 2026-06-02 (consecutive),
--   log3 -> 2026-06-05 (gap -> reset).
\set log1 'dddddddd-0001-1111-1111-111111111111'
\set log2 'dddddddd-0002-1111-1111-111111111111'
\set log3 'dddddddd-0003-1111-1111-111111111111'
-- log4 (2026-06-10) is the authz/validation target, seeded pending below.
\set log4 'dddddddd-0004-1111-1111-111111111111'

insert into auth.users (id, instance_id, aud, role, email)
  values (:'authParentA', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pa-read@example.com'),
         (:'authParentB', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pb-read@example.com');

insert into families (id, name) values (:'famA', 'Family A'), (:'famB', 'Family B');

insert into profiles (id, family_id, role, display_name, auth_user_id)
  values (:'parentA', :'famA', 'parent', 'Parent A', :'authParentA'),
         (:'parentB', :'famB', 'parent', 'Parent B', :'authParentB');

insert into profiles (id, family_id, role, display_name, pin_hash, age_mode)
  values (:'kidA', :'famA', 'kid', 'Kid A', 'hashA', 'detailed'),
         (:'kidB', :'famB', 'kid', 'Kid B', 'hashB', 'detailed');

-- Pending reading logs for kid A. log1-3 drive the streak scenarios; log4 is the
-- authz/validation target. All seeded here (as postgres, RLS-bypassed) because a
-- parent session cannot INSERT reading_logs under RLS (kid-insert only).
insert into reading_logs (id, family_id, kid_id, book_title, minutes, read_on, status)
  values (:'log1', :'famA', :'kidA', 'Book One',   20, date '2026-06-01', 'pending'),
         (:'log2', :'famA', :'kidA', 'Book Two',   15, date '2026-06-02', 'pending'),
         (:'log3', :'famA', :'kidA', 'Book Three', 30, date '2026-06-05', 'pending'),
         (:'log4', :'famA', :'kidA', 'Book Four',  25, date '2026-06-10', 'pending');

-- Sanity: the 003 trigger bootstrapped kid A's wallet (0) and streak (0/0/null).
do $$
declare bal int; cur int; lng int; lrd date;
begin
  select wallet_balance into bal from wallets where kid_id = '1c111111-aaaa-1111-1111-111111111111';
  if bal <> 0 then raise exception 'FAIL: kid A wallet not bootstrapped at 0, got %', bal; end if;
  select current_streak, longest_streak, last_read_date into cur, lng, lrd
    from reading_streaks where kid_id = '1c111111-aaaa-1111-1111-111111111111';
  if cur <> 0 or lng <> 0 or lrd is not null then
    raise exception 'FAIL: kid A streak not bootstrapped at 0/0/null, got %/%/%', cur, lng, lrd; end if;
  raise notice 'PASS: kid A wallet + reading_streak bootstrapped (0 / 0,0,null)';
end $$;


-- ===========================================================================
-- SECTION 1 — POSITIVE: parent approves the FIRST pending reading.
--   wallet += points, an 'earn' ledger row (positive, linked, awarded_by)
--   exists, log status='approved', and the streak becomes current=1/longest=1.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"1a111111-aaaa-1111-1111-111111111111"}';
do $$
declare
  v_txn uuid; bal int;
  v_type point_txn_type; v_amount int; v_note text; v_by uuid; v_fam uuid; v_kid uuid; v_link uuid;
  v_status reading_status; v_awarded int; v_revby uuid; v_revat timestamptz;
  cur int; lng int; lrd date;
begin
  v_txn := approve_reading_log('dddddddd-0001-1111-1111-111111111111',
                               '1b111111-aaaa-1111-1111-111111111111', 30);
  if v_txn is null then raise exception 'FAIL: approve_reading_log returned null'; end if;

  select wallet_balance into bal from wallets where kid_id = '1c111111-aaaa-1111-1111-111111111111';
  if bal <> 30 then raise exception 'FAIL: expected balance 30 after approval, got %', bal; end if;

  select type, amount, note, awarded_by, family_id, kid_id, reading_log_id
    into v_type, v_amount, v_note, v_by, v_fam, v_kid, v_link
    from point_transactions where id = v_txn;
  if v_type <> 'earn' then raise exception 'FAIL: ledger type not earn, got %', v_type; end if;
  if v_amount <> 30 then raise exception 'FAIL: ledger amount not +30, got %', v_amount; end if;
  if v_note <> 'Reading approved' then raise exception 'FAIL: note wrong, got %', v_note; end if;
  if v_by <> '1b111111-aaaa-1111-1111-111111111111' then
    raise exception 'FAIL: awarded_by not the parent, got %', v_by; end if;
  if v_fam <> '11111111-aaaa-1111-1111-111111111111' then
    raise exception 'FAIL: ledger family_id wrong, got %', v_fam; end if;
  if v_kid <> '1c111111-aaaa-1111-1111-111111111111' then
    raise exception 'FAIL: ledger kid_id wrong, got %', v_kid; end if;
  if v_link <> 'dddddddd-0001-1111-1111-111111111111' then
    raise exception 'FAIL: ledger reading_log_id not linked, got %', v_link; end if;

  select status, awarded_points, reviewed_by, reviewed_at
    into v_status, v_awarded, v_revby, v_revat
    from reading_logs where id = 'dddddddd-0001-1111-1111-111111111111';
  if v_status <> 'approved' then raise exception 'FAIL: log not approved, got %', v_status; end if;
  if v_awarded <> 30 then raise exception 'FAIL: awarded_points not 30, got %', v_awarded; end if;
  if v_revby <> '1b111111-aaaa-1111-1111-111111111111' then
    raise exception 'FAIL: reviewed_by not parent, got %', v_revby; end if;
  if v_revat is null then raise exception 'FAIL: reviewed_at not set'; end if;

  select current_streak, longest_streak, last_read_date into cur, lng, lrd
    from reading_streaks where kid_id = '1c111111-aaaa-1111-1111-111111111111';
  if cur <> 1 or lng <> 1 or lrd <> date '2026-06-01' then
    raise exception 'FAIL: first-read streak not 1/1/2026-06-01, got %/%/%', cur, lng, lrd; end if;

  raise notice 'PASS: parent approves first reading -> wallet +30, earn ledger row linked, log approved, streak 1/1';
end $$;


-- ===========================================================================
-- SECTION 2 — STREAK EXTEND: approve a CONSECUTIVE-day reading (read_on + 1).
--   current_streak -> 2, longest_streak -> 2.
-- ===========================================================================
do $$
declare cur int; lng int; lrd date; bal int;
begin
  perform approve_reading_log('dddddddd-0002-1111-1111-111111111111',
                              '1b111111-aaaa-1111-1111-111111111111', 20);

  select wallet_balance into bal from wallets where kid_id = '1c111111-aaaa-1111-1111-111111111111';
  if bal <> 50 then raise exception 'FAIL: expected balance 50 after 2nd approval, got %', bal; end if;

  select current_streak, longest_streak, last_read_date into cur, lng, lrd
    from reading_streaks where kid_id = '1c111111-aaaa-1111-1111-111111111111';
  if cur <> 2 or lng <> 2 or lrd <> date '2026-06-02' then
    raise exception 'FAIL: consecutive-day streak not 2/2/2026-06-02, got %/%/%', cur, lng, lrd; end if;

  raise notice 'PASS: consecutive-day approval extends streak -> current=2, longest=2';
end $$;


-- ===========================================================================
-- SECTION 3 — STREAK RESET ON GAP: approve a reading 3 days later (gap).
--   current_streak resets to 1; longest_streak stays 2.
-- ===========================================================================
do $$
declare cur int; lng int; lrd date;
begin
  perform approve_reading_log('dddddddd-0003-1111-1111-111111111111',
                              '1b111111-aaaa-1111-1111-111111111111', 10);

  select current_streak, longest_streak, last_read_date into cur, lng, lrd
    from reading_streaks where kid_id = '1c111111-aaaa-1111-1111-111111111111';
  if cur <> 1 then raise exception 'FAIL: gap did not reset current_streak to 1, got %', cur; end if;
  if lng <> 2 then raise exception 'FAIL: longest_streak should stay 2 across a gap, got %', lng; end if;
  if lrd <> date '2026-06-05' then raise exception 'FAIL: last_read_date not advanced to gap day, got %', lrd; end if;

  raise notice 'PASS: gapped approval resets current_streak to 1, longest stays 2';
end $$;


-- ===========================================================================
-- SECTION 4 — IDEMPOTENT: re-approving the FIRST (already-approved) log returns
--   the SAME earn ledger id, writes no second earn row, and does not touch the
--   wallet or streak.
-- ===========================================================================
do $$
declare v_first uuid; v_again uuid; n int; bal int; cur int; lng int; lrd date;
begin
  select id into v_first from point_transactions
    where reading_log_id = 'dddddddd-0001-1111-1111-111111111111' and type = 'earn';

  v_again := approve_reading_log('dddddddd-0001-1111-1111-111111111111',
                                 '1b111111-aaaa-1111-1111-111111111111', 999);
  if v_again <> v_first then
    raise exception 'FAIL: re-approval returned a different id (% vs %)', v_again, v_first; end if;

  select count(*) into n from point_transactions
    where reading_log_id = 'dddddddd-0001-1111-1111-111111111111' and type = 'earn';
  if n <> 1 then raise exception 'FAIL: re-approval created a second earn row (count %)', n; end if;

  -- Wallet + streak unchanged from section 3 (30+20+10 = 60 spendable; streak 1/2/2026-06-05).
  select wallet_balance into bal from wallets where kid_id = '1c111111-aaaa-1111-1111-111111111111';
  if bal <> 60 then raise exception 'FAIL: re-approval changed wallet to %', bal; end if;
  select current_streak, longest_streak, last_read_date into cur, lng, lrd
    from reading_streaks where kid_id = '1c111111-aaaa-1111-1111-111111111111';
  if cur <> 1 or lng <> 2 or lrd <> date '2026-06-05' then
    raise exception 'FAIL: re-approval changed streak to %/%/%', cur, lng, lrd; end if;

  raise notice 'PASS: re-approving an approved log is idempotent (same id, no 2nd earn, wallet/streak untouched)';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION 5 — AUTHZ: a KID session is rejected (insufficient_privilege),
-- including approving their OWN reading. Attacks the pending log4.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"11111111-aaaa-1111-1111-111111111111","profile_id":"1c111111-aaaa-1111-1111-111111111111"}';
do $$
declare v_status reading_status; bal int;
begin
  begin
    perform approve_reading_log('dddddddd-0004-1111-1111-111111111111',
                                '1c111111-aaaa-1111-1111-111111111111', 100);
    raise exception 'FAIL: kid approved their own reading';
  exception when insufficient_privilege then null;
  end;

  -- Log still pending; wallet unchanged (still 50).
  select status into v_status from reading_logs where id = 'dddddddd-0004-1111-1111-111111111111';
  if v_status <> 'pending' then raise exception 'FAIL: kid approval changed status to %', v_status; end if;
  select wallet_balance into bal from wallets where kid_id = '1c111111-aaaa-1111-1111-111111111111';
  if bal <> 60 then raise exception 'FAIL: kid approval changed wallet to %', bal; end if;

  raise notice 'PASS: a kid CANNOT approve a reading (incl. their own)';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION 6 — ISOLATION: a different family's parent (B) is rejected.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"2a222222-bbbb-2222-2222-222222222222"}';
do $$
declare v_status reading_status;
begin
  begin
    perform approve_reading_log('dddddddd-0004-1111-1111-111111111111',
                                '2b222222-bbbb-2222-2222-222222222222', 100);
    raise exception 'FAIL: parent B approved family A reading';
  exception when insufficient_privilege then null;
  end;

  select status into v_status from reading_logs where id = 'dddddddd-0004-1111-1111-111111111111';
  if v_status <> 'pending' then raise exception 'FAIL: cross-family approval changed status to %', v_status; end if;

  raise notice 'PASS: a different family''s parent CANNOT approve (family isolation)';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION 7 — VALIDATION: p_points <= 0 (and null) rejected (check_violation);
-- and approving an already-REJECTED log is rejected (check_violation).
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"1a111111-aaaa-1111-1111-111111111111"}';
do $$
declare v_status reading_status;
begin
  -- Non-positive / null points on a still-pending log (log4).
  begin
    perform approve_reading_log('dddddddd-0004-1111-1111-111111111111',
                                '1b111111-aaaa-1111-1111-111111111111', 0);
    raise exception 'FAIL: zero-point approval accepted';
  exception when check_violation then null;
  end;
  begin
    perform approve_reading_log('dddddddd-0004-1111-1111-111111111111',
                                '1b111111-aaaa-1111-1111-111111111111', -5);
    raise exception 'FAIL: negative-point approval accepted';
  exception when check_violation then null;
  end;
  begin
    perform approve_reading_log('dddddddd-0004-1111-1111-111111111111',
                                '1b111111-aaaa-1111-1111-111111111111', null);
    raise exception 'FAIL: null-point approval accepted';
  exception when check_violation then null;
  end;

  -- Still pending (no partial write).
  select status into v_status from reading_logs where id = 'dddddddd-0004-1111-1111-111111111111';
  if v_status <> 'pending' then raise exception 'FAIL: rejected-validation left status %', v_status; end if;

  -- A rejected log cannot be approved. Reject log4 via direct UPDATE (the path a
  -- parent uses under reading_logs_parent_update), then try to approve it.
  update reading_logs set status = 'rejected', reviewed_by = '1b111111-aaaa-1111-1111-111111111111', reviewed_at = now()
    where id = 'dddddddd-0004-1111-1111-111111111111';
  begin
    perform approve_reading_log('dddddddd-0004-1111-1111-111111111111',
                                '1b111111-aaaa-1111-1111-111111111111', 10);
    raise exception 'FAIL: approved a rejected reading_log';
  exception when check_violation then null;
  end;

  raise notice 'PASS: non-positive/null points rejected; a rejected log cannot be approved';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


do $$ begin raise notice '======== ALL TESTS PASSED ========'; end $$;

rollback;
