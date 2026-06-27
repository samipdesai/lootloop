-- 011_consent_record.sql
-- COPPA verifiable-parental-consent ARTIFACT (#54). The on-screen affirmation on
-- the signup screen (web + mobile) is the consent UX; this is the durable record
-- that proves *when* a parent consented and to *which* privacy-policy version,
-- stamped atomically when the family is created.
--
-- Design: the policy version is the value current at deploy time, hardcoded in
-- the bootstrap function. It is set once at family creation and never changed
-- afterward, so each family's row is a historical record of what that parent
-- agreed to. When the privacy policy materially changes, bump the version string
-- in a follow-up migration (new families get the new version; existing rows keep
-- theirs). See docs/compliance/coppa-kids-data-review.md §2.3.

alter table families
  add column if not exists consent_accepted_at  timestamptz,
  add column if not exists consent_policy_version text;

-- Recreate create_family_and_parent (from 004) to additionally stamp the consent
-- record. Logic is otherwise identical to the existing definition.
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

  -- Bootstrap is for real auth.users (parents) only; reject kid sessions.
  if auth_is_kid() then
    raise exception 'kids cannot create a family'
      using errcode = 'insufficient_privilege';
  end if;

  -- A user who already has a profile has already onboarded.
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

  -- Stamp the consent artifact atomically with family creation. The version is
  -- the privacy-policy version current at this deploy (mirrors the web
  -- /privacy "Last updated" date).
  insert into families (name, consent_accepted_at, consent_policy_version)
    values (btrim(p_family_name), now(), '2026-06-24')
    returning id into v_family_id;

  insert into profiles (family_id, role, display_name, auth_user_id)
    values (v_family_id, 'parent', btrim(p_display_name), v_uid);

  return v_family_id;
end;
$$;

-- Re-assert the locked-down grant (matches 010): client RPC callable only by
-- authenticated users, never anon/public. CREATE OR REPLACE preserves the ACL,
-- but we re-assert defensively given prior grant drift on the remote.
revoke all on function create_family_and_parent(text, text) from public, anon;
grant execute on function create_family_and_parent(text, text) to authenticated;
