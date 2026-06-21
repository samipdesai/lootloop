-- LootLoop kid-management + family-code login DB foundation
-- (tasks #9-client / #15 / #16).
--
-- =============================================================================
-- WHAT THIS MIGRATION ADDS
-- =============================================================================
-- (a) families.kid_code — a REUSABLE, parent-ROTATABLE 8-char family code a kid
--     device types in to fetch the family roster and log in by PIN. Distinct
--     from family_invites (single-use co-parent invites in 004): kid_code never
--     expires and is not consumed; a parent can rotate it. Auto-generated for
--     every family via a BEFORE INSERT trigger (so the existing onboarding path
--     create_family_and_parent() in 004 keeps working unchanged) and backfilled
--     for all pre-existing families. Read by the family's own parent through the
--     existing families_select RLS policy — NOT exposed to anon (the anon roster
--     lookup is a separate Edge Function over a direct DB connection).
--
-- (b) Parent-authorized kid-management RPCs (create/update/delete kid, set PIN)
--     plus regenerate_family_code(). Each is SECURITY DEFINER (owner = postgres,
--     bypasses RLS) and SELF-AUTHORIZES the caller per the atomic-fn-caller-authz
--     convention: every RPC requires auth_role() = 'parent' and operates ONLY
--     within auth_family_id() (kids and cross-family callers are rejected).
--     search_path is pinned (incl. `extensions` for pgcrypto's crypt/gen_salt).
--
-- PIN hashing CONTRACT (with the kid-auth Edge Function, task #9): bcrypt cost 10
-- in standard modular-crypt format. pgcrypto's crypt(pin, gen_salt('bf', 10))
-- produces a hash that bcryptjs.compare() verifies. create_kid / set_kid_pin both
-- hash this way so kid-auth can later verify the PIN.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- (a) families.kid_code — reusable, rotatable, unambiguous 8-char family code.
--
-- Generation reuses the exact technique from create_family_invite() (004): a
-- crypto-random 8-char string over the unambiguous alphabet
-- 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' (no 0/O/1/I, so a parent can read it aloud).
-- A SECURITY DEFINER helper generates a guaranteed-unique code (collision-retry
-- loop against the live column); the BEFORE INSERT trigger and the backfill below
-- both use it, so there is a single source of truth for the format.
-- ---------------------------------------------------------------------------

-- Generate a fresh code that is not already present in families.kid_code.
-- SECURITY DEFINER + STRICT search_path: reads families regardless of caller RLS
-- (the trigger fires under the inserting principal; the helper must still see the
-- whole column to guarantee global uniqueness).
create or replace function gen_unique_kid_code()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text;
begin
  loop
    v_code := (
      select string_agg(
        substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, g) % 32), 1),
        '' order by g
      )
      from (select gen_random_bytes(8) as b) s, generate_series(0, 7) as g
    );
    -- Re-roll on the (vanishingly rare) chance of a collision with a live code.
    exit when not exists (select 1 from families where kid_code = v_code);
  end loop;
  return v_code;
end;
$$;

revoke all on function gen_unique_kid_code() from public;
-- Not callable by clients directly; used by the trigger and the rotate RPC only.

-- Add the column nullable first so the trigger can populate it, then backfill
-- existing rows, then enforce NOT NULL + UNIQUE.
alter table families add column kid_code text;

-- BEFORE INSERT trigger: assign a unique code whenever one isn't explicitly set.
-- Covers create_family_and_parent() (004) and any future family insert without
-- editing that migration.
create or replace function set_family_kid_code()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.kid_code is null then
    new.kid_code := gen_unique_kid_code();
  end if;
  return new;
end;
$$;

create trigger families_set_kid_code
  before insert on families
  for each row execute function set_family_kid_code();

-- Backfill every existing family with a unique code (the trigger only fires on
-- new inserts). Loop one row at a time so each gets a freshly-checked code.
do $$
declare
  r record;
begin
  for r in select id from families where kid_code is null loop
    update families set kid_code = gen_unique_kid_code() where id = r.id;
  end loop;
end $$;

alter table families alter column kid_code set not null;
alter table families add constraint families_kid_code_key unique (kid_code);


-- ---------------------------------------------------------------------------
-- (b) Parent-authorized kid-management RPCs.
--
-- All are SECURITY DEFINER and self-authorize: auth_role() = 'parent' AND the
-- target stays within auth_family_id(). Errors use SQLSTATEs mirroring 004:
--   insufficient_privilege — caller is not a parent (kid / unauthenticated)
--   check_violation        — bad input (blank name, malformed PIN)
--   no_data_found          — target kid not in the caller's family
-- ---------------------------------------------------------------------------

-- Shared PIN-shape guard: 4–10 digits, nothing else. Raised as check_violation.
-- (bcrypt truncates >72 bytes; a 4–10 digit PIN is well under that.)

-- create_kid(display_name, pin, age_mode, [birthdate], [avatar_url]) -> uuid
-- Inserts a kid profile in the caller's family with a bcrypt(cost 10) PIN hash.
-- The 003 trigger auto-creates the kid's wallet + reading_streak — not duplicated
-- here. Returns the new kid's profiles.id.
create or replace function create_kid(
  p_display_name text,
  p_pin text,
  p_age_mode age_mode,
  p_birthdate date default null,
  p_avatar_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_family_id uuid := auth_family_id();
  v_kid_id    uuid;
begin
  if auth_role() is distinct from 'parent' or v_family_id is null then
    raise exception 'only a parent may create a kid'
      using errcode = 'insufficient_privilege';
  end if;

  if coalesce(btrim(p_display_name), '') = '' then
    raise exception 'display name is required'
      using errcode = 'check_violation';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,10}$' then
    raise exception 'pin must be 4 to 10 digits'
      using errcode = 'check_violation';
  end if;

  insert into profiles (
    family_id, role, display_name, pin_hash, age_mode, birthdate, avatar_url
  )
  values (
    v_family_id,
    'kid',
    btrim(p_display_name),
    crypt(p_pin, gen_salt('bf', 10)),
    p_age_mode,
    p_birthdate,
    p_avatar_url
  )
  returning id into v_kid_id;

  return v_kid_id;
end;
$$;


-- update_kid(kid_id, [display_name], [age_mode], [avatar_url], [birthdate]) -> void
-- Updates only the provided (non-null) fields on a kid in the caller's family.
-- Never touches role / family_id / pin_hash. NULL args leave that field as-is, so
-- this cannot blank a field — by design (use set_kid_pin / a future dedicated RPC
-- for those). Clearing avatar_url is out of scope here.
create or replace function update_kid(
  p_kid_id uuid,
  p_display_name text default null,
  p_age_mode age_mode default null,
  p_avatar_url text default null,
  p_birthdate date default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_family_id uuid := auth_family_id();
begin
  if auth_role() is distinct from 'parent' or v_family_id is null then
    raise exception 'only a parent may update a kid'
      using errcode = 'insufficient_privilege';
  end if;

  if p_display_name is not null and coalesce(btrim(p_display_name), '') = '' then
    raise exception 'display name cannot be blank'
      using errcode = 'check_violation';
  end if;

  update profiles
     set display_name = coalesce(btrim(p_display_name), display_name),
         age_mode     = coalesce(p_age_mode, age_mode),
         avatar_url   = coalesce(p_avatar_url, avatar_url),
         birthdate    = coalesce(p_birthdate, birthdate)
   where id = p_kid_id
     and family_id = v_family_id
     and role = 'kid';

  if not found then
    raise exception 'kid not found in your family'
      using errcode = 'no_data_found';
  end if;
end;
$$;


-- set_kid_pin(kid_id, pin) -> void
-- Re-hashes the kid's PIN with bcrypt cost 10. Parent-only, own family.
create or replace function set_kid_pin(
  p_kid_id uuid,
  p_pin text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_family_id uuid := auth_family_id();
begin
  if auth_role() is distinct from 'parent' or v_family_id is null then
    raise exception 'only a parent may set a kid pin'
      using errcode = 'insufficient_privilege';
  end if;

  if p_pin is null or p_pin !~ '^[0-9]{4,10}$' then
    raise exception 'pin must be 4 to 10 digits'
      using errcode = 'check_violation';
  end if;

  update profiles
     set pin_hash = crypt(p_pin, gen_salt('bf', 10))
   where id = p_kid_id
     and family_id = v_family_id
     and role = 'kid';

  if not found then
    raise exception 'kid not found in your family'
      using errcode = 'no_data_found';
  end if;
end;
$$;


-- delete_kid(kid_id) -> void
-- Hard-deletes the kid profile; FKs cascade wallet / ledgers / streak. Parent-
-- only, own family.
create or replace function delete_kid(
  p_kid_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_family_id uuid := auth_family_id();
begin
  if auth_role() is distinct from 'parent' or v_family_id is null then
    raise exception 'only a parent may delete a kid'
      using errcode = 'insufficient_privilege';
  end if;

  delete from profiles
   where id = p_kid_id
     and family_id = v_family_id
     and role = 'kid';

  if not found then
    raise exception 'kid not found in your family'
      using errcode = 'no_data_found';
  end if;
end;
$$;


-- regenerate_family_code() -> text
-- Rotates the caller's families.kid_code to a fresh unique code and returns it.
-- Parent-only; always targets auth_family_id() so a parent can only rotate their
-- own family's code.
create or replace function regenerate_family_code()
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_family_id uuid := auth_family_id();
  v_code      text;
begin
  if auth_role() is distinct from 'parent' or v_family_id is null then
    raise exception 'only a parent may regenerate the family code'
      using errcode = 'insufficient_privilege';
  end if;

  v_code := gen_unique_kid_code();

  update families set kid_code = v_code where id = v_family_id;

  return v_code;
end;
$$;


-- ---------------------------------------------------------------------------
-- Grants. All five kid-management RPCs are SECURITY DEFINER + self-authorizing
-- (parent-only, own family). EXECUTE to `authenticated` only — NEVER `anon`.
-- (The anon roster lookup is a separate Edge Function over a direct postgres
-- connection, not these RPCs.)
-- ---------------------------------------------------------------------------
revoke all on function create_kid(text, text, age_mode, date, text)    from public;
revoke all on function update_kid(uuid, text, age_mode, text, date)    from public;
revoke all on function set_kid_pin(uuid, text)                         from public;
revoke all on function delete_kid(uuid)                                from public;
revoke all on function regenerate_family_code()                        from public;

grant execute on function create_kid(text, text, age_mode, date, text)    to authenticated;
grant execute on function update_kid(uuid, text, age_mode, text, date)    to authenticated;
grant execute on function set_kid_pin(uuid, text)                         to authenticated;
grant execute on function delete_kid(uuid)                                to authenticated;
grant execute on function regenerate_family_code()                        to authenticated;
