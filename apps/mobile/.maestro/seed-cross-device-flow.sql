-- Deterministic seed for the Maestro CROSS-DEVICE realtime flow (task #47 / M6).
-- Runs as the postgres superuser (bypasses RLS) against the local Supabase DB.
-- Idempotent: wipes + recreates a dedicated test family so each run starts clean
-- (the completion is always 'pending', so the out-of-band approval always credits).
--
-- This flow proves the kid's realtime subscription (task #41): the kid app parks
-- on Home showing a known starting balance, the harness fires
-- award_points_on_approval(...) over the postgres connection mid-flow (the
-- server-side effect of the web parent "Approve" button), and the kid's wallet
-- balance updates LIVE with no manual refresh / no kid action.
--
-- Fixed family code MAESTRO7 / kid Ava / PIN 1234 (matches the other flows). The
-- parent auth user (parent@maestro.test / Maestro1!) is created out-of-band by the
-- harness via the GoTrue admin API; this seed links a parent profile to it so the
-- approval call resolves auth_role()='parent' + auth_family_id() for the family.
--
-- Balances chosen to be unambiguous + non-colliding on the Home screen:
--   starting wallet_balance = 500  → renders "500"
--   pending chore worth       75
--   POST-approval balance   = 575  → renders "575"  (the live assertion target)
set search_path = public, extensions;

-- Cascade-delete any prior run (clears kid, parent profile, chore, instance,
-- completion, wallet) so each run starts from a clean, pending state.
delete from families where name = 'Maestro Test Family';

-- Family with the KNOWN code. The BEFORE INSERT trigger only fills kid_code when
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

-- Parent profile bound to the seeded auth user (role='parent', auth_user_id set so
-- the GoTrue 'sub' claim the harness sets resolves auth_role()='parent' +
-- auth_family_id() inside award_points_on_approval). Fixed id so the harness can
-- pass it as the p_reviewer_id (reviewed_by / awarded_by).
insert into profiles (id, family_id, role, display_name, auth_user_id)
select 'aaaaaaaa-0000-0000-0000-000000000004',
       'aaaaaaaa-0000-0000-0000-000000000001', 'parent', 'Parent', u.id
from auth.users u
where u.email = 'parent@maestro.test';

-- Ava's known STARTING balance (set directly for the test — bypasses the atomic
-- fn). 500 is what the kid sees on Home before the approval lands.
update wallets set wallet_balance = 500
 where kid_id = 'aaaaaaaa-0000-0000-0000-000000000002';

-- A chore assigned to Ava worth 75 points.
insert into chores (id, family_id, title, points, assignment, assigned_kid_id, active)
values (
  'aaaaaaaa-0000-0000-0000-000000000003',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Make your bed', 75, 'assigned',
  'aaaaaaaa-0000-0000-0000-000000000002', true
);

-- Today's instance for that chore (points snapshot = 75 — award_points_on_approval
-- credits the instance's points). UTC current_date is fine here: the approval is
-- keyed by completion id, not by the device's local "today".
insert into chore_instances (id, family_id, chore_id, due_date, points)
values (
  'aaaaaaaa-0000-0000-0000-000000000005',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000003', current_date, 75
);

-- A PENDING completion from Ava, ready for the parent to approve out-of-band.
-- Fixed completion id so the harness can pass it to award_points_on_approval.
insert into chore_completions (id, family_id, chore_instance_id, kid_id, status, submitted_at)
values (
  'aaaaaaaa-0000-0000-0000-000000000006',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000005',
  'aaaaaaaa-0000-0000-0000-000000000002', 'pending', now()
);
