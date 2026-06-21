-- LootLoop integration tests (tasks #9-client / #15 / #16): kid-management RPCs
-- + reusable/rotatable family code (families.kid_code).
--
-- Runs against the LOCAL Supabase Postgres (after `supabase db reset`). Plain
-- SQL + assertions — no pgTAP. Deterministic: seeds fixed UUIDs, runs inside ONE
-- transaction that ROLLBACKs at the end, so the DB is untouched and re-runnable.
--
-- HOW TO RUN:
--   supabase db reset        # apply 001->005 fresh
--   docker exec -i supabase_db_Lootloop psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f - < supabase/tests/kid_management_test.sql
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
-- Fixed UUIDs: two families (A, B), each with a parent. Kids are created via the
-- create_kid() RPC under test (NOT seeded directly) so we exercise the real path.
-- ---------------------------------------------------------------------------
\set famA  '11111111-aaaa-1111-1111-111111111111'
\set famB  '22222222-bbbb-2222-2222-222222222222'

\set authParentA '1a111111-aaaa-1111-1111-111111111111'
\set authParentB '2a222222-bbbb-2222-2222-222222222222'

\set parentA '1b111111-aaaa-1111-1111-111111111111'
\set parentB '2b222222-bbbb-2222-2222-222222222222'

insert into auth.users (id, instance_id, aud, role, email)
  values (:'authParentA', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pa-km@example.com'),
         (:'authParentB', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pb-km@example.com');

-- Seed families explicitly (the BEFORE INSERT trigger fills kid_code).
insert into families (id, name) values (:'famA', 'Family A'), (:'famB', 'Family B');

insert into profiles (id, family_id, role, display_name, auth_user_id)
  values (:'parentA', :'famA', 'parent', 'Parent A', :'authParentA'),
         (:'parentB', :'famB', 'parent', 'Parent B', :'authParentB');


-- ===========================================================================
-- SECTION 0 — kid_code backfill / trigger: every family has a non-null, unique,
-- 8-char unambiguous code.
-- ===========================================================================
do $$
declare n int; bad int;
begin
  -- No nulls.
  select count(*) into n from families where kid_code is null;
  if n <> 0 then raise exception 'FAIL: % families have null kid_code', n; end if;

  -- All unique (across the WHOLE table, incl. any pre-existing seeded families).
  select count(*) into n from families;
  select count(distinct kid_code) into bad from families;
  if n <> bad then raise exception 'FAIL: kid_code not unique (% rows, % distinct)', n, bad; end if;

  -- Format: exactly 8 chars from the unambiguous alphabet (no 0/O/1/I).
  select count(*) into bad from families
    where kid_code !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$';
  if bad <> 0 then raise exception 'FAIL: % families have malformed kid_code', bad; end if;

  raise notice 'PASS: every family has a non-null, unique, 8-char unambiguous kid_code';
end $$;


-- ===========================================================================
-- SECTION 1 — create_kid: AUTHZ + correctness (PIN round-trips via bcrypt;
-- wallet + streak auto-created by the 003 trigger).
-- ===========================================================================

-- 1a. ADVERSARIAL: a kid session cannot create a kid (parent-only).
--     (Use parent A's family + a throwaway profile_id for the claim.)
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"11111111-aaaa-1111-1111-111111111111","profile_id":"1b111111-aaaa-1111-1111-111111111111"}';
do $$
begin
  perform create_kid('Sneaky', '1234', 'detailed');
  raise exception 'FAIL: kid created a kid';
exception when insufficient_privilege then
  raise notice 'PASS: a kid CANNOT create a kid (parent-only)';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

-- 1b. POSITIVE: parent A creates a kid -> exists, bcrypt PIN round-trips, wallet
--     + streak auto-created, name trimmed, fields stored.
set local role authenticated;
set local request.jwt.claims = '{"sub":"1a111111-aaaa-1111-1111-111111111111"}';
do $$
declare
  v_kid uuid; v_fam uuid; v_role profile_role; v_name text; v_age age_mode;
  v_hash text; v_bd date; n int;
begin
  v_kid := create_kid('  Ava  ', '4321', 'simple', date '2017-05-01', 'https://img/ava.png');
  if v_kid is null then raise exception 'FAIL: create_kid returned null'; end if;

  select family_id, role, display_name, age_mode, pin_hash, birthdate
    into v_fam, v_role, v_name, v_age, v_hash, v_bd
    from profiles where id = v_kid;

  if v_fam <> '11111111-aaaa-1111-1111-111111111111' then
    raise exception 'FAIL: kid not in parent A family'; end if;
  if v_role <> 'kid' then raise exception 'FAIL: role not kid'; end if;
  if v_name <> 'Ava' then raise exception 'FAIL: display_name not trimmed, got %', v_name; end if;
  if v_age <> 'simple' then raise exception 'FAIL: age_mode wrong, got %', v_age; end if;
  if v_bd <> date '2017-05-01' then raise exception 'FAIL: birthdate wrong, got %', v_bd; end if;

  -- bcrypt MCF format + the PIN must verify against the stored hash.
  if v_hash !~ '^\$2[aby]\$10\$' then
    raise exception 'FAIL: pin_hash is not bcrypt cost-10 MCF, got %', v_hash; end if;
  if crypt('4321', v_hash) <> v_hash then
    raise exception 'FAIL: PIN does not round-trip against stored hash'; end if;
  if crypt('0000', v_hash) = v_hash then
    raise exception 'FAIL: wrong PIN verified against hash'; end if;

  -- The 003 trigger auto-created wallet + reading_streak (not duplicated by RPC).
  select count(*) into n from wallets where kid_id = v_kid;
  if n <> 1 then raise exception 'FAIL: expected 1 wallet, got %', n; end if;
  select count(*) into n from reading_streaks where kid_id = v_kid;
  if n <> 1 then raise exception 'FAIL: expected 1 streak, got %', n; end if;

  raise notice 'PASS: parent creates a kid -> bcrypt PIN round-trips + wallet/streak auto-created';
end $$;

-- 1c. VALIDATION: blank name and malformed PINs rejected.
do $$
begin
  begin
    perform create_kid('   ', '1234', 'detailed');
    raise exception 'FAIL: blank display name accepted';
  exception when check_violation then
    raise notice 'PASS: blank display name rejected';
  end;
  begin
    perform create_kid('Bo', '12', 'detailed');         -- too short
    raise exception 'FAIL: 2-digit PIN accepted';
  exception when check_violation then null;
  end;
  begin
    perform create_kid('Bo', '12345678901', 'detailed'); -- 11 digits, too long
    raise exception 'FAIL: 11-digit PIN accepted';
  exception when check_violation then null;
  end;
  begin
    perform create_kid('Bo', '12ab', 'detailed');        -- non-digit
    raise exception 'FAIL: non-digit PIN accepted';
  exception when check_violation then null;
  end;
  raise notice 'PASS: create_kid rejects blank name + PINs that are not 4-10 digits';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION 2 — update_kid + set_kid_pin: correctness + family isolation.
-- ===========================================================================

-- Create a kid in family A to operate on (capture id via temp table for later
-- sessions).
set local role authenticated;
set local request.jwt.claims = '{"sub":"1a111111-aaaa-1111-1111-111111111111"}';
create temporary table _t_kid (id uuid);
insert into _t_kid select create_kid('Ben', '1111', 'detailed', null, null);

-- 2a. POSITIVE: update only provided fields; nulls leave fields untouched.
do $$
declare v_kid uuid; v_name text; v_age age_mode; v_avatar text;
begin
  select id into v_kid from _t_kid;

  -- Change name + age_mode only; avatar stays null, birthdate stays null.
  perform update_kid(v_kid, '  Benjamin  ', 'teen', null, null);
  select display_name, age_mode, avatar_url into v_name, v_age, v_avatar
    from profiles where id = v_kid;
  if v_name <> 'Benjamin' then raise exception 'FAIL: name not updated/trimmed, got %', v_name; end if;
  if v_age <> 'teen' then raise exception 'FAIL: age_mode not updated, got %', v_age; end if;
  if v_avatar is not null then raise exception 'FAIL: null avatar arg overwrote field'; end if;

  -- Now set an avatar; name/age must be preserved (passed null).
  perform update_kid(v_kid, null, null, 'https://img/ben.png', null);
  select display_name, age_mode, avatar_url into v_name, v_age, v_avatar
    from profiles where id = v_kid;
  if v_name <> 'Benjamin' or v_age <> 'teen' then
    raise exception 'FAIL: null args clobbered existing fields'; end if;
  if v_avatar <> 'https://img/ben.png' then raise exception 'FAIL: avatar not set'; end if;

  raise notice 'PASS: update_kid changes only provided fields (nulls preserved)';
end $$;

-- 2b. POSITIVE: set_kid_pin re-hashes; new PIN verifies, old does not.
do $$
declare v_kid uuid; v_hash text;
begin
  select id into v_kid from _t_kid;
  perform set_kid_pin(v_kid, '987654');
  select pin_hash into v_hash from profiles where id = v_kid;
  if v_hash !~ '^\$2[aby]\$10\$' then raise exception 'FAIL: new hash not bcrypt cost-10'; end if;
  if crypt('987654', v_hash) <> v_hash then raise exception 'FAIL: new PIN does not verify'; end if;
  if crypt('1111', v_hash) = v_hash then raise exception 'FAIL: old PIN still verifies'; end if;

  -- Bad PIN rejected.
  begin
    perform set_kid_pin(v_kid, 'abc');
    raise exception 'FAIL: bad PIN accepted by set_kid_pin';
  exception when check_violation then null;
  end;

  raise notice 'PASS: set_kid_pin re-hashes (bcrypt 10); new PIN verifies, old does not; bad PIN rejected';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

-- 2c. ISOLATION: a KID session is rejected by update_kid / set_kid_pin.
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"11111111-aaaa-1111-1111-111111111111","profile_id":"1b111111-aaaa-1111-1111-111111111111"}';
do $$
declare v_kid uuid;
begin
  select id into v_kid from _t_kid;
  begin
    perform update_kid(v_kid, 'Hacked', null, null, null);
    raise exception 'FAIL: kid updated a kid';
  exception when insufficient_privilege then null;
  end;
  begin
    perform set_kid_pin(v_kid, '0000');
    raise exception 'FAIL: kid set a kid PIN';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: a kid session CANNOT update_kid / set_kid_pin (parent-only)';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

-- 2d. ISOLATION: a DIFFERENT family's parent (B) cannot touch family A's kid —
--     the row is outside their auth_family_id(), so the RPC reports not-found.
set local role authenticated;
set local request.jwt.claims = '{"sub":"2a222222-bbbb-2222-2222-222222222222"}';
do $$
declare v_kid uuid; v_name text;
begin
  select id into v_kid from _t_kid;  -- a family A kid

  begin
    perform update_kid(v_kid, 'CrossFamily', null, null, null);
    raise exception 'FAIL: parent B updated family A kid';
  exception when no_data_found then null;
  end;
  begin
    perform set_kid_pin(v_kid, '5555');
    raise exception 'FAIL: parent B set family A kid PIN';
  exception when no_data_found then null;
  end;
  begin
    perform delete_kid(v_kid);
    raise exception 'FAIL: parent B deleted family A kid';
  exception when no_data_found then null;
  end;

  -- The family A kid is untouched.
  select display_name into v_name from profiles where id = v_kid;
  if v_name <> 'Benjamin' then raise exception 'FAIL: family A kid was modified by parent B'; end if;

  raise notice 'PASS: a different family''s parent CANNOT update/set-pin/delete a kid (isolation holds)';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION 3 — delete_kid: parent-only, own family, cascades.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"1a111111-aaaa-1111-1111-111111111111"}';
do $$
declare v_kid uuid; n int;
begin
  select id into v_kid from _t_kid;

  delete from _t_kid;  -- about to remove the profile; clear our reference too

  perform delete_kid(v_kid);

  select count(*) into n from profiles where id = v_kid;
  if n <> 0 then raise exception 'FAIL: kid profile not deleted'; end if;
  -- Wallet + streak cascade away with the profile (FK on delete cascade).
  select count(*) into n from wallets where kid_id = v_kid;
  if n <> 0 then raise exception 'FAIL: wallet not cascaded on kid delete'; end if;
  select count(*) into n from reading_streaks where kid_id = v_kid;
  if n <> 0 then raise exception 'FAIL: streak not cascaded on kid delete'; end if;

  -- Deleting again -> not found.
  begin
    perform delete_kid(v_kid);
    raise exception 'FAIL: deleting an absent kid succeeded';
  exception when no_data_found then null;
  end;

  raise notice 'PASS: delete_kid hard-deletes kid + cascades wallet/streak';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION 4 — regenerate_family_code: parent-only, own family, stays unique.
-- ===========================================================================

-- 4a. ADVERSARIAL: a kid cannot rotate the family code.
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"11111111-aaaa-1111-1111-111111111111","profile_id":"1b111111-aaaa-1111-1111-111111111111"}';
do $$
begin
  perform regenerate_family_code();
  raise exception 'FAIL: kid rotated the family code';
exception when insufficient_privilege then
  raise notice 'PASS: a kid CANNOT regenerate the family code (parent-only)';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

-- 4b. POSITIVE: parent A rotates -> code CHANGES, return value matches the row,
--     stays globally unique, and only family A's code changed (B untouched).
set local role authenticated;
set local request.jwt.claims = '{"sub":"1a111111-aaaa-1111-1111-111111111111"}';
do $$
declare v_old text; v_new text; v_row text; v_bold text; v_bnew text; n int; d int;
begin
  select kid_code into v_old from families where id = '11111111-aaaa-1111-1111-111111111111';
  select kid_code into v_bold from families where id = '22222222-bbbb-2222-2222-222222222222';

  v_new := regenerate_family_code();
  if v_new = v_old then raise exception 'FAIL: code did not change'; end if;
  if v_new !~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$' then
    raise exception 'FAIL: rotated code malformed: %', v_new; end if;

  select kid_code into v_row from families where id = '11111111-aaaa-1111-1111-111111111111';
  if v_row <> v_new then raise exception 'FAIL: returned code != stored code'; end if;

  -- Family B's code is unchanged (rotation is scoped to caller's family).
  select kid_code into v_bnew from families where id = '22222222-bbbb-2222-2222-222222222222';
  if v_bnew <> v_bold then raise exception 'FAIL: parent A rotation changed family B code'; end if;

  -- Still globally unique.
  select count(*), count(distinct kid_code) into n, d from families;
  if n <> d then raise exception 'FAIL: kid_code not unique after rotation'; end if;

  raise notice 'PASS: parent rotates own family code -> changes, returns it, stays unique, B untouched';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


do $$ begin raise notice '======== ALL TESTS PASSED ========'; end $$;

rollback;
