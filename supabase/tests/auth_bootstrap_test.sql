-- LootLoop integration tests (task #8): family onboarding / parent-auth bootstrap.
--
-- Runs against the LOCAL Supabase Postgres (after `supabase db reset`). Plain
-- SQL + assertions — no pgTAP. Deterministic: seeds fixed UUIDs, runs inside ONE
-- transaction that ROLLBACKs at the end, so the DB is untouched and re-runnable.
--
-- HOW TO RUN:
--   supabase db reset        # apply 001->002->003->004 fresh
--   docker exec -i supabase_db_Lootloop psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f - < supabase/tests/auth_bootstrap_test.sql
--
-- A passing run prints "PASS:" NOTICEs and ends with "ALL TESTS PASSED".
--
-- Session simulation (mirrors how PostgREST sets context per request):
--   confirmed auth user (parent-to-be, NO profile yet):
--           set local role authenticated;
--           set local request.jwt.claims = '{"sub":"<auth.users.id>"}';
--   reset:  reset role; select set_config('request.jwt.claims', NULL, true);

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Fixed UUIDs. Several "fresh" auth users with NO profile (the bootstrap entry
-- state), plus an existing family A with a parent + kid (seeded the same way the
-- app would AFTER onboarding) to exercise invite/join + adversarial paths.
-- ---------------------------------------------------------------------------
-- authFresh1 creates a new family; authFresh2 joins family A; authFresh3/4 adversarial.
\set authFresh1  'f0000001-0000-0000-0000-000000000001'
\set authFresh2  'f0000002-0000-0000-0000-000000000002'
\set authFresh3  'f0000003-0000-0000-0000-000000000003'
\set authFresh4  'f0000004-0000-0000-0000-000000000004'

-- Pre-existing family A (parent A + kid A), seeded privileged (bypasses RLS).
\set famA        'a1111111-1111-1111-1111-111111111111'
\set authParentA 'a2222222-2222-2222-2222-222222222222'
\set parentA     'a3333333-3333-3333-3333-333333333333'
\set kidA        'a4444444-4444-4444-4444-444444444444'

-- A second, unrelated family B (parent B) — for the cross-family invite test.
\set famB        'b1111111-1111-1111-1111-111111111111'
\set authParentB 'b2222222-2222-2222-2222-222222222222'
\set parentB     'b3333333-3333-3333-3333-333333333333'

insert into auth.users (id, instance_id, aud, role, email) values
  (:'authFresh1',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fresh1@example.com'),
  (:'authFresh2',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fresh2@example.com'),
  (:'authFresh3',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fresh3@example.com'),
  (:'authFresh4',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fresh4@example.com'),
  (:'authParentA', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pa@example.com'),
  (:'authParentB', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pb@example.com');

insert into families (id, name) values (:'famA', 'Family A'), (:'famB', 'Family B');
insert into profiles (id, family_id, role, display_name, auth_user_id) values
  (:'parentA', :'famA', 'parent', 'Parent A', :'authParentA'),
  (:'parentB', :'famB', 'parent', 'Parent B', :'authParentB');
insert into profiles (id, family_id, role, display_name, pin_hash, age_mode) values
  (:'kidA', :'famA', 'kid', 'Kid A', 'hashA', 'detailed');


-- ===========================================================================
-- SECTION 1 — create_family_and_parent
-- ===========================================================================

-- 1a. UNAUTHENTICATED: no auth.uid() -> rejected.
do $$
begin
  perform create_family_and_parent('Ghost Fam', 'Nobody');
  raise exception 'FAIL: unauthenticated created a family';
exception when insufficient_privilege then
  raise notice 'PASS: unauthenticated create_family_and_parent rejected';
end $$;

-- 1b. POSITIVE: fresh confirmed auth user creates a family + becomes its parent.
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000001-0000-0000-0000-000000000001"}';
do $$
declare v_fam uuid; v_role profile_role; v_name text; v_fname text;
begin
  v_fam := create_family_and_parent('  Fresh Family  ', '  Dana  ');
  if v_fam is null then raise exception 'FAIL: returned null family_id'; end if;

  -- The helpers now resolve this caller as a parent in the new family.
  if auth_family_id() <> v_fam then raise exception 'FAIL: auth_family_id != new family'; end if;
  if auth_role() <> 'parent' then raise exception 'FAIL: new user not a parent'; end if;

  select role, display_name into v_role, v_name
    from profiles where auth_user_id = 'f0000001-0000-0000-0000-000000000001';
  if v_role <> 'parent' then raise exception 'FAIL: profile role not parent'; end if;
  if v_name <> 'Dana' then raise exception 'FAIL: display_name not trimmed/stored, got %', v_name; end if;

  select name into v_fname from families where id = v_fam;
  if v_fname <> 'Fresh Family' then raise exception 'FAIL: family name not trimmed/stored, got %', v_fname; end if;

  -- Consent artifact stamped at creation (#54, migration 011).
  perform 1 from families
    where id = v_fam and consent_accepted_at is not null and consent_policy_version = '2026-06-24';
  if not found then raise exception 'FAIL: consent record not stamped on new family'; end if;

  raise notice 'PASS: fresh user creates family + parent profile (names trimmed, consent stamped)';
end $$;

-- 1c. RE-BIND: the SAME user calling again is rejected (already has a profile).
do $$
begin
  perform create_family_and_parent('Second Family', 'Dana Again');
  raise exception 'FAIL: existing user created a second family';
exception when unique_violation then
  raise notice 'PASS: user with an existing profile cannot create another family';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

-- 1d. VALIDATION: blank family/display name rejected (fresh user 4).
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000004-0000-0000-0000-000000000004"}';
do $$
begin
  begin
    perform create_family_and_parent('   ', 'Has Name');
    raise exception 'FAIL: blank family name accepted';
  exception when check_violation then
    raise notice 'PASS: blank family name rejected';
  end;
  begin
    perform create_family_and_parent('Has Family', '   ');
    raise exception 'FAIL: blank display name accepted';
  exception when check_violation then
    raise notice 'PASS: blank display name rejected';
  end;
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION 2 — create_family_invite + join_family_as_parent (happy path)
-- ===========================================================================

-- 2a. AUTHZ: a kid cannot create an invite (not a parent).
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","ll_role":"kid","family_id":"a1111111-1111-1111-1111-111111111111","profile_id":"a4444444-4444-4444-4444-444444444444"}';
do $$
begin
  perform create_family_invite();
  raise exception 'FAIL: kid created a family invite';
exception when insufficient_privilege then
  raise notice 'PASS: kid CANNOT create a family invite (parent-only)';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

-- 2b. POSITIVE: parent A mints an invite for family A; assert it is theirs,
--     unused, ~7-day expiry, URL-safe code.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a2222222-2222-2222-2222-222222222222"}';
do $$
declare v_code text; v_inv family_invites%rowtype;
begin
  v_code := create_family_invite();
  if v_code is null or char_length(v_code) < 6 then
    raise exception 'FAIL: bad invite code "%"', v_code; end if;
  if v_code ~ '[+/=]' then raise exception 'FAIL: code not URL-safe: %', v_code; end if;

  select * into v_inv from family_invites where code = v_code;
  if v_inv.family_id <> 'a1111111-1111-1111-1111-111111111111' then
    raise exception 'FAIL: invite not scoped to parent A family'; end if;
  if v_inv.created_by <> 'a3333333-3333-3333-3333-333333333333' then
    raise exception 'FAIL: invite created_by not parent A profile'; end if;
  if v_inv.used_at is not null then raise exception 'FAIL: new invite already used'; end if;
  if v_inv.expires_at <= now() or v_inv.expires_at > now() + interval '8 days' then
    raise exception 'FAIL: invite expiry not ~7 days, got %', v_inv.expires_at; end if;

  -- Parent A can SELECT their own invite under RLS.
  if (select count(*) from family_invites where code = v_code) <> 1 then
    raise exception 'FAIL: parent A cannot see own invite under RLS'; end if;

  raise notice 'PASS: parent mints a URL-safe, 7-day, own-family invite (visible under RLS)';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

-- 2c. POSITIVE: a fresh user joins family A with the code -> becomes a parent
--     there; invite marked used; family A kid roster + wallets unaffected.
--     (Capture the code into a temp table so the join session can read it.)
set local role authenticated;
set local request.jwt.claims = '{"sub":"a2222222-2222-2222-2222-222222222222"}';
create temporary table _t_code (code text);  -- typo guard below
insert into _t_code select create_family_invite();
reset role;
select set_config('request.jwt.claims', NULL, true);

set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000002-0000-0000-0000-000000000002"}';
do $$
declare v_code text; v_fam uuid; v_role profile_role; v_used_by uuid; v_used_at timestamptz;
begin
  select code into v_code from _t_code;

  v_fam := join_family_as_parent(v_code, 'Co Parent');
  if v_fam <> 'a1111111-1111-1111-1111-111111111111' then
    raise exception 'FAIL: joined wrong family, got %', v_fam; end if;

  -- New parent resolves into family A.
  if auth_family_id() <> 'a1111111-1111-1111-1111-111111111111' then
    raise exception 'FAIL: joiner auth_family_id wrong'; end if;
  if auth_role() <> 'parent' then raise exception 'FAIL: joiner not a parent'; end if;

  select role into v_role from profiles where auth_user_id = 'f0000002-0000-0000-0000-000000000002';
  if v_role <> 'parent' then raise exception 'FAIL: joiner profile role not parent'; end if;

  -- Invite consumed.
  select used_at, used_by into v_used_at, v_used_by from family_invites where code = v_code;
  if v_used_at is null then raise exception 'FAIL: invite not marked used'; end if;
  if v_used_by <> (select id from profiles where auth_user_id='f0000002-0000-0000-0000-000000000002') then
    raise exception 'FAIL: used_by not the joiner profile'; end if;

  -- Family A unaffected otherwise: still exactly one kid, and the kid's wallet
  -- bootstrap (003 trigger) is untouched.
  if (select count(*) from profiles where family_id='a1111111-1111-1111-1111-111111111111' and role='kid') <> 1 then
    raise exception 'FAIL: kid roster changed'; end if;
  if (select count(*) from wallets where kid_id='a4444444-4444-4444-4444-444444444444') <> 1 then
    raise exception 'FAIL: kid A wallet missing'; end if;

  raise notice 'PASS: fresh user joins family A via invite -> parent; invite consumed; roster intact';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION 3 — join adversarial paths (invalid / expired / used / re-bind)
-- ===========================================================================

-- 3a. INVALID code rejected.
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000003-0000-0000-0000-000000000003"}';
do $$
begin
  perform join_family_as_parent('does-not-exist', 'Hacker');
  raise exception 'FAIL: invalid code accepted';
exception when no_data_found then
  raise notice 'PASS: invalid invite code rejected';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

-- 3b. ALREADY-USED code rejected (reuse the consumed 2c code via fresh user 3).
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000003-0000-0000-0000-000000000003"}';
do $$
declare v_code text;
begin
  select code into v_code from _t_code;  -- the now-used invite
  begin
    perform join_family_as_parent(v_code, 'Late Joiner');
    raise exception 'FAIL: already-used code accepted';
  exception when check_violation then
    raise notice 'PASS: already-used invite code rejected';
  end;
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

-- 3c. EXPIRED code rejected. Mint one as parent A, back-date it (privileged),
--     then a fresh user tries to redeem.
set local role authenticated;
set local request.jwt.claims = '{"sub":"a2222222-2222-2222-2222-222222222222"}';
insert into _t_code select create_family_invite();  -- second row = the expiring one
reset role;
select set_config('request.jwt.claims', NULL, true);

-- Back-date the most recent invite's expiry (privileged DML, bypasses RLS).
update family_invites set expires_at = now() - interval '1 day'
  where code = (select code from _t_code order by ctid desc limit 1);

set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000003-0000-0000-0000-000000000003"}';
do $$
declare v_code text;
begin
  select code into v_code from _t_code order by ctid desc limit 1;
  begin
    perform join_family_as_parent(v_code, 'Too Late');
    raise exception 'FAIL: expired code accepted';
  exception when check_violation then
    raise notice 'PASS: expired invite code rejected';
  end;
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);

-- 3d. RE-BIND: a user who ALREADY has a profile cannot join another family.
--     (Parent A is already a parent in family A; have them try to join via a
--     fresh valid invite from family B.)
set local role authenticated;
set local request.jwt.claims = '{"sub":"b2222222-2222-2222-2222-222222222222"}';
insert into _t_code(code) select create_family_invite();  -- family B invite
reset role;
select set_config('request.jwt.claims', NULL, true);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a2222222-2222-2222-2222-222222222222"}';  -- existing parent A
do $$
declare v_code text;
begin
  select code into v_code from _t_code order by ctid desc limit 1;  -- family B invite
  perform join_family_as_parent(v_code, 'Greedy Parent');
  raise exception 'FAIL: existing parent joined a second family';
exception when unique_violation then
  raise notice 'PASS: a user with an existing profile cannot join another family';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


-- ===========================================================================
-- SECTION 4 — cross-family: a parent cannot mint invites for another family.
-- create_family_invite() always targets the CALLER's auth_family_id(), so parent
-- B can only ever create invites for family B — never family A.
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"b2222222-2222-2222-2222-222222222222"}';
do $$
declare v_code text; v_fam uuid;
begin
  v_code := create_family_invite();
  select family_id into v_fam from family_invites where code = v_code;
  if v_fam <> 'b1111111-1111-1111-1111-111111111111' then
    raise exception 'FAIL: parent B minted an invite for family %, not their own', v_fam; end if;
  if v_fam = 'a1111111-1111-1111-1111-111111111111' then
    raise exception 'FAIL: parent B minted an invite for family A'; end if;
  raise notice 'PASS: a parent can only mint invites for their OWN family (no cross-family)';
end $$;

-- And parent B cannot SEE family A's invites under RLS.
do $$
declare n int;
begin
  select count(*) into n from family_invites
    where family_id = 'a1111111-1111-1111-1111-111111111111';
  if n <> 0 then raise exception 'FAIL: parent B can SELECT family A invites (n=%)', n; end if;
  raise notice 'PASS: parent B cannot see family A invites under RLS';
end $$;
reset role;
select set_config('request.jwt.claims', NULL, true);


do $$ begin raise notice '======== ALL TESTS PASSED ========'; end $$;

rollback;
