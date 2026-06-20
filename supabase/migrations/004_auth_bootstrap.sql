-- LootLoop family onboarding / parent-auth bootstrap (task #8).
--
-- =============================================================================
-- WHY THIS MIGRATION EXISTS
-- =============================================================================
-- RLS (002) deliberately leaves family creation to "elevated context": the
-- `families` table has only a SELECT policy, and `profiles` INSERT requires
-- `auth_role() = 'parent'` — but a freshly-signed-up parent (an auth.users row
-- with NO profile yet) has auth_role() = NULL and auth_family_id() = NULL. They
-- literally cannot self-insert their first family or profile under RLS. That is
-- the bootstrap seam, and it is crossed ONLY through the SECURITY DEFINER
-- functions below (owned by postgres, bypass RLS), each of which authorizes the
-- caller in-body per the atomic-fn-caller-authz convention.
--
-- The caller of these bootstrap functions is a *profile-less* confirmed auth
-- user. They cannot be authorized by auth_role()/auth_family_id() (those return
-- NULL with no profile). Instead the bootstrap functions authorize on:
--   * auth.uid() IS NOT NULL          — a real, confirmed Supabase Auth session.
--   * NOT EXISTS(profile for uid)     — they have not already onboarded (this is
--                                       what blocks re-binding / duplicate
--                                       families / hijacking a 2nd family).
-- After onboarding they have a parent profile and the normal auth_* helpers
-- resolve them, so all further work goes through ordinary RLS.
--
-- search_path is pinned on every SECURITY DEFINER function (defeats search_path
-- hijacking), and EXECUTE is revoked from public then granted narrowly.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- family_invites — short, URL-safe, single-use codes a parent generates to let
-- a co-parent join their existing family.
--
-- Rows are created ONLY via create_family_invite() (SECURITY DEFINER); there is
-- no INSERT policy, so clients cannot forge invites. Parents may read/manage
-- (revoke) their own family's invites. The JOINING user is profile-less and so
-- cannot SELECT the invite under RLS — join_family_as_parent() validates the
-- code under elevated context on their behalf.
-- ---------------------------------------------------------------------------
create table family_invites (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families (id) on delete cascade,
  code        text not null unique check (char_length(code) between 6 and 32),
  created_by  uuid not null references profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  used_by     uuid references profiles (id) on delete set null
);
create index family_invites_family_id_idx on family_invites (family_id);
create index family_invites_code_idx      on family_invites (code);

-- Clients reach the table only for SELECT/UPDATE/DELETE on their own family's
-- invites (parents revoke by DELETE or by updating). No INSERT grant: invites
-- are minted exclusively by create_family_invite().
grant select, update, delete on family_invites to authenticated;

alter table family_invites enable row level security;

-- Parents see and manage their own family's invites. Kids and other families
-- see nothing. (Profile-less joiners also see nothing — by design.)
create policy family_invites_parent_select on family_invites
  for select using (family_id = auth_family_id() and auth_role() = 'parent');

create policy family_invites_parent_update on family_invites
  for update using (family_id = auth_family_id() and auth_role() = 'parent')
          with check (family_id = auth_family_id());

create policy family_invites_parent_delete on family_invites
  for delete using (family_id = auth_family_id() and auth_role() = 'parent');


-- ===========================================================================
-- create_family_and_parent(p_family_name, p_display_name) -> uuid (family_id)
--
-- Called by a freshly-confirmed auth user during onboarding to create a brand
-- new family and become its first parent.
--
-- Guards:
--   * auth.uid() IS NOT NULL                  (must be a confirmed auth session)
--   * no existing profile for auth.uid()      (blocks re-binding / a user
--                                              spinning up a second family or
--                                              re-onboarding over an existing one)
--   * p_family_name / p_display_name non-blank (the 001 CHECKs also enforce len)
--
-- Effect (one transaction):
--   1. insert families(name = p_family_name)
--   2. insert profiles(role='parent', auth_user_id=auth.uid(), display_name)
--
-- Returns: the new families.id.
-- ===========================================================================
create or replace function create_family_and_parent(
  p_family_name text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid       uuid := auth.uid();
  v_family_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated'
      using errcode = 'insufficient_privilege';
  end if;

  -- Bootstrap is for real auth.users (parents) only. A kid session (kid-auth
  -- JWT) has auth.uid() = its profile id, which would otherwise slip past the
  -- "no existing profile" check and only be stopped by the auth_user_id FK.
  -- Reject it cleanly here.
  if auth_is_kid() then
    raise exception 'kids cannot create a family'
      using errcode = 'insufficient_privilege';
  end if;

  -- A user who already has a profile has already onboarded — refuse to create
  -- another family or re-bind. (Covers both parents and the impossible case of
  -- an auth user already linked to a kid.)
  if exists (select 1 from profiles where auth_user_id = v_uid) then
    raise exception 'user already belongs to a family'
      using errcode = 'unique_violation';
  end if;

  if coalesce(btrim(p_family_name), '') = '' then
    raise exception 'family name is required'
      using errcode = 'check_violation';
  end if;
  if coalesce(btrim(p_display_name), '') = '' then
    raise exception 'display name is required'
      using errcode = 'check_violation';
  end if;

  insert into families (name)
    values (btrim(p_family_name))
    returning id into v_family_id;

  insert into profiles (family_id, role, display_name, auth_user_id)
    values (v_family_id, 'parent', btrim(p_display_name), v_uid);

  return v_family_id;
end;
$$;


-- ===========================================================================
-- create_family_invite() -> text (the invite code)
--
-- Called by an existing PARENT to mint a single-use, URL-safe invite code that
-- a co-parent can redeem via join_family_as_parent(). Expires in 7 days.
--
-- Guards (this is RLS-bypassing + granted to authenticated, so it self-authz):
--   * caller is a parent (auth_role() = 'parent') in some family.
--
-- The invite is always created for auth_family_id() — the CALLER's own family —
-- so a parent can never mint an invite for a family that isn't theirs.
--
-- Returns: the generated code.
-- ===========================================================================
create or replace function create_family_invite()
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_family_id  uuid := auth_family_id();
  v_profile_id uuid := auth_profile_id();
  v_code       text;
begin
  if auth_role() is distinct from 'parent' or v_family_id is null then
    raise exception 'only a parent may create a family invite'
      using errcode = 'insufficient_privilege';
  end if;

  -- 9 random bytes -> base64url (~12 chars), URL-safe (no +,/,=). Retry on the
  -- (astronomically unlikely) unique-code collision.
  loop
    v_code := translate(encode(gen_random_bytes(9), 'base64'), '+/=', '-_');
    begin
      insert into family_invites (family_id, code, created_by, expires_at)
        values (v_family_id, v_code, v_profile_id, now() + interval '7 days');
      exit;
    exception when unique_violation then
      -- collision on code — loop and regenerate.
    end;
  end loop;

  return v_code;
end;
$$;


-- ===========================================================================
-- join_family_as_parent(p_code, p_display_name) -> uuid (family_id)
--
-- Called by a freshly-confirmed auth user to join an EXISTING family as a
-- co-parent by redeeming an invite code.
--
-- Guards:
--   * auth.uid() IS NOT NULL
--   * no existing profile for auth.uid()       (a user who already onboarded
--                                              cannot join another family)
--   * code exists, not expired, not already used
--   * p_display_name non-blank
--
-- The joining user is profile-less, so they cannot SELECT the invite under RLS;
-- this function validates + consumes it under elevated context. The invite row
-- is locked FOR UPDATE so two concurrent redemptions of the same code can't both
-- succeed (the second sees used_at set).
--
-- Effect (one transaction):
--   1. validate + lock the invite
--   2. insert profiles(role='parent', auth_user_id=auth.uid()) in the invite's family
--   3. mark the invite used (used_at = now(), used_by = new profile id)
--
-- Returns: the joined families.id.
-- ===========================================================================
create or replace function join_family_as_parent(
  p_code text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid     uuid := auth.uid();
  v_invite  family_invites%rowtype;
  v_profile_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated'
      using errcode = 'insufficient_privilege';
  end if;

  -- Real auth.users (parents) only — reject kid sessions cleanly (see
  -- create_family_and_parent for the rationale).
  if auth_is_kid() then
    raise exception 'kids cannot join a family as a parent'
      using errcode = 'insufficient_privilege';
  end if;

  if exists (select 1 from profiles where auth_user_id = v_uid) then
    raise exception 'user already belongs to a family'
      using errcode = 'unique_violation';
  end if;

  if coalesce(btrim(p_display_name), '') = '' then
    raise exception 'display name is required'
      using errcode = 'check_violation';
  end if;

  -- Lock the invite row so concurrent redemptions serialize on it.
  select * into v_invite
    from family_invites
   where code = p_code
   for update;

  if not found then
    raise exception 'invalid invite code'
      using errcode = 'no_data_found';
  end if;
  if v_invite.used_at is not null then
    raise exception 'invite code already used'
      using errcode = 'check_violation';
  end if;
  if v_invite.expires_at <= now() then
    raise exception 'invite code expired'
      using errcode = 'check_violation';
  end if;

  insert into profiles (family_id, role, display_name, auth_user_id)
    values (v_invite.family_id, 'parent', btrim(p_display_name), v_uid)
    returning id into v_profile_id;

  update family_invites
     set used_at = now(),
         used_by = v_profile_id
   where id = v_invite.id;

  return v_invite.family_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- Grants. All three are SECURITY DEFINER (bypass RLS) and self-authorize:
--   * create_family_and_parent / join_family_as_parent: callable by a
--     profile-less confirmed auth user; gated on auth.uid() + "no existing
--     profile". Granted to authenticated.
--   * create_family_invite: gated on auth_role()='parent'. Granted to
--     authenticated.
-- anon is never granted EXECUTE.
-- ---------------------------------------------------------------------------
revoke all on function create_family_and_parent(text, text) from public;
revoke all on function create_family_invite()               from public;
revoke all on function join_family_as_parent(text, text)    from public;

grant execute on function create_family_and_parent(text, text) to authenticated;
grant execute on function create_family_invite()               to authenticated;
grant execute on function join_family_as_parent(text, text)    to authenticated;
