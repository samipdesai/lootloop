-- LootLoop account & family deletion (task #52, Milestone 7).
--
-- =============================================================================
-- WHAT THIS MIGRATION ADDS
-- =============================================================================
-- Two parent-facing HARD-delete operations (no soft-delete):
--
--   1. leave_family()  — the calling parent removes ONLY themselves. Allowed
--      only if at least one OTHER parent remains in the family. Deletes the
--      caller's own profiles row and returns the caller's auth_user_id so the
--      delete-account Edge Function can finish the job by removing the matching
--      auth.users row (GoTrue admin API). If the caller is the LAST parent, it
--      RAISES — they must delete_family() instead (otherwise the family would be
--      left with kids and no adult who can log in).
--
--   2. delete_family() — any parent in the family deletes the ENTIRE family.
--      Deletes the families row; the existing ON DELETE CASCADE FKs (001) wipe
--      every family-scoped row (profiles/kids, chores, instances, completions,
--      wallets, ledgers, rewards, purchases, reading, savings, schedule, invites).
--      Returns the set of parent auth_user_ids in that family so the Edge
--      Function can delete each matching auth.users row.
--
-- Both are SECURITY DEFINER (owner = postgres, bypass RLS) and SELF-AUTHORIZE
-- the caller in-body per the atomic-fn-caller-authz convention, using the 002
-- helpers auth_role() / auth_family_id() / auth_profile_id(): reject non-parents
-- (kids, unauthenticated) and only ever act on the caller's OWN family. EXECUTE
-- is revoked from public then granted to `authenticated` only. search_path is
-- pinned (defeats search_path hijacking on SECURITY DEFINER functions).
--
-- WHY THE EDGE FN DELETES auth.users (not these SQL functions):
--   profiles.auth_user_id -> auth.users(id) is ON DELETE CASCADE, so removing an
--   auth.users row would cascade-delete the profile. But these functions run as
--   the DB principal and have no privilege to delete from auth.users, and the
--   GoTrue auth schema is owned by the auth service — the supported way to drop a
--   user is the GoTrue admin API (auth.admin.deleteUser). So we delete the
--   profile/family here (atomic, RLS-safe) and HAND BACK the auth_user_id(s) for
--   the Edge Function to remove from auth via the service-role admin client.
--   (After the profile is gone, the later auth.users delete cascades into nothing
--   — harmless.)
-- =============================================================================


-- ===========================================================================
-- leave_family() -> uuid (the leaving parent's auth_user_id)
--
-- The calling parent leaves their family. Guards:
--   * caller is a parent (auth_role() = 'parent') in some family.
--   * at least one OTHER parent remains (>= 2 parents total before leaving) —
--     otherwise RAISE: the last parent must delete_family() instead.
--
-- Effect (one transaction): delete the caller's own profiles row.
-- Returns: the caller's auth_user_id (for the Edge Function to delete from auth).
-- ===========================================================================
create or replace function leave_family()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_family_id  uuid := auth_family_id();
  v_profile_id uuid := auth_profile_id();
  v_auth_uid   uuid;
  v_parent_count int;
begin
  if auth_role() is distinct from 'parent' or v_family_id is null then
    raise exception 'only a parent may leave the family'
      using errcode = 'insufficient_privilege';
  end if;

  -- Count parents in the caller's family. A parent always has auth_user_id set.
  select count(*) into v_parent_count
    from profiles
   where family_id = v_family_id
     and role = 'parent';

  if v_parent_count <= 1 then
    raise exception 'you are the last parent — delete the family instead of leaving'
      using errcode = 'check_violation';
  end if;

  -- Capture the caller's auth_user_id BEFORE deleting the row, to return it.
  select auth_user_id into v_auth_uid
    from profiles
   where id = v_profile_id
     and family_id = v_family_id
     and role = 'parent';

  if v_auth_uid is null then
    -- Defensive: the caller's parent profile must exist with an auth link.
    raise exception 'caller parent profile not found'
      using errcode = 'no_data_found';
  end if;

  delete from profiles
   where id = v_profile_id
     and family_id = v_family_id
     and role = 'parent';

  return v_auth_uid;
end;
$$;


-- ===========================================================================
-- delete_family() -> setof uuid (every parent auth_user_id in the family)
--
-- Any parent in the family deletes the ENTIRE family. Guards:
--   * caller is a parent (auth_role() = 'parent') in some family.
--
-- Effect (one transaction): gather the set of parent auth_user_ids first (before
-- the delete removes them), then delete the families row — CASCADE wipes
-- everything family-scoped. Always targets auth_family_id(), so a parent can
-- only ever delete their OWN family.
-- Returns: one row per parent auth_user_id (for the Edge Function to delete from
-- auth). Kids have no auth.users row, so they are not returned.
-- ===========================================================================
create or replace function delete_family()
returns setof uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_family_id uuid := auth_family_id();
  v_auth_uids uuid[];
begin
  if auth_role() is distinct from 'parent' or v_family_id is null then
    raise exception 'only a parent may delete the family'
      using errcode = 'insufficient_privilege';
  end if;

  -- Gather the parent auth_user_ids BEFORE the cascade removes the profiles.
  select array_agg(auth_user_id) into v_auth_uids
    from profiles
   where family_id = v_family_id
     and role = 'parent'
     and auth_user_id is not null;

  delete from families where id = v_family_id;

  return query select unnest(coalesce(v_auth_uids, array[]::uuid[]));
end;
$$;


-- ---------------------------------------------------------------------------
-- Grants. Both are SECURITY DEFINER + self-authorizing (parent-only, own
-- family). EXECUTE to `authenticated` only — NEVER `anon`.
-- ---------------------------------------------------------------------------
revoke all on function leave_family()  from public;
revoke all on function delete_family() from public;

grant execute on function leave_family()  to authenticated;
grant execute on function delete_family() to authenticated;
