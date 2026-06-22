-- Deterministic seed for the Maestro kid golden-path flow (task #47).
-- Runs as the postgres superuser (bypasses RLS) against the local Supabase DB.
-- Idempotent: wipes and recreates a dedicated test family so each run starts clean
-- (no leftover completion from a prior run, so "Make your bed" is always actionable).
--
-- Fixed family code MAESTRO7 + kid Ava / PIN 1234 so the flow can hardcode them.
-- pgcrypto's crypt()/gen_salt() may live in the `extensions` schema on Supabase.
set search_path = public, extensions;

-- Cascade-delete any prior run (clears kid, chore, instance, completion, wallet).
delete from families where name = 'Maestro Test Family';

-- Family with a KNOWN code. The BEFORE INSERT trigger only fills kid_code when
-- null, so providing it explicitly keeps our fixed value.
insert into families (id, name, kid_code)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Maestro Test Family', 'MAESTRO7');

-- Kid Ava, PIN 1234 (bcrypt, cost 10 — matches the kid-auth verify contract).
-- The ensure_kid_wallet_and_streak trigger auto-creates her wallet + streak.
insert into profiles (id, family_id, role, display_name, pin_hash, age_mode)
values (
  'aaaaaaaa-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'kid', 'Ava', crypt('1234', gen_salt('bf', 10)), 'detailed'
);

-- A chore assigned to Ava + today's materialized instance (My Chores reads
-- instances, not templates).
insert into chores (id, family_id, title, points, assignment, assigned_kid_id, active)
values (
  'aaaaaaaa-0000-0000-0000-000000000003',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Make your bed', 10, 'assigned',
  'aaaaaaaa-0000-0000-0000-000000000002', true
);

-- The app reads "today" from the DEVICE's LOCAL date (todayISO() in
-- MyChoresScreen), but this seed runs in the DB whose current_date is UTC. In the
-- evening Pacific (and other offsets) those differ by a day, hiding the chore.
-- Materialize the instance for yesterday/today/tomorrow (UTC) so exactly one row
-- matches the device's local today on any timezone — the app filters to that one.
insert into chore_instances (id, family_id, chore_id, due_date, points)
select gen_random_uuid(),
       'aaaaaaaa-0000-0000-0000-000000000001',
       'aaaaaaaa-0000-0000-0000-000000000003',
       d, 10
from (values (current_date - 1), (current_date), (current_date + 1)) as t(d);
