-- Deterministic seed for the Maestro PARENT golden-path flow.
-- Runs as the postgres superuser (bypasses RLS) against the local Supabase DB.
-- The parent auth user (parent@maestro.test / Maestro1!) is created out-of-band
-- by run-parent-flow.sh via the GoTrue admin API; this seed links a parent
-- profile to it and rebuilds the family + a kid so the parent sees real data.
set search_path = public, extensions;

-- Cascade-delete any prior run (clears kid, parent profile, chores, wallets).
delete from families where name = 'Maestro Test Family';

insert into families (id, name, kid_code)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Maestro Test Family', 'MAESTRO7');

-- Kid Ava (the ensure_kid_wallet_and_streak trigger makes her wallet + streak).
insert into profiles (id, family_id, role, display_name, pin_hash, age_mode)
values (
  'aaaaaaaa-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'kid', 'Ava', crypt('1234', gen_salt('bf', 10)), 'detailed'
);

-- Parent profile bound to the seeded auth user (role='parent', auth_user_id set
-- so the GoTrue session resolves to this family via the 002 RLS helpers).
insert into profiles (id, family_id, role, display_name, auth_user_id)
select gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'parent', 'Parent', u.id
from auth.users u
where u.email = 'parent@maestro.test';

-- Give Ava a visible balance for the Family-overview kid card.
update wallets set wallet_balance = 1240, savings_balance = 860
where kid_id = 'aaaaaaaa-0000-0000-0000-000000000002';

-- A chore so the Manage-chores list (#21) shows a real card.
insert into chores (id, family_id, title, points, assignment, assigned_kid_id, active, icon)
values (
  'aaaaaaaa-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000001',
  'Feed the dog', 15, 'assigned', 'aaaaaaaa-0000-0000-0000-000000000002', true, 'dog'
);

-- Today's instance + a pending completion from Ava, so the Approval queue (#22)
-- has a card to review.
insert into chore_instances (id, family_id, chore_id, due_date, points)
values (
  'aaaaaaaa-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000010', current_date, 15
);
insert into chore_completions (id, family_id, chore_instance_id, kid_id, status, submitted_at)
values (
  'aaaaaaaa-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000002', 'pending', now()
);

-- A schedule item so the Schedule screen (#36) shows a real row.
insert into schedule_items (id, family_id, kid_id, title, icon, start_time, end_time, days_of_week, active)
values (
  'aaaaaaaa-0000-0000-0000-000000000020', 'aaaaaaaa-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000002', 'Homework time', 'book-open', '16:00', '17:00', '{1,2,3,4,5}', true
);

-- Rewards so the Rewards (Store) screen shows real cards.
insert into rewards (id, family_id, title, emoji, cost, active) values
 ('aaaaaaaa-0000-0000-0000-000000000030', 'aaaaaaaa-0000-0000-0000-000000000001', 'Ice cream Sundae', '🍦', 200, true),
 ('aaaaaaaa-0000-0000-0000-000000000031', 'aaaaaaaa-0000-0000-0000-000000000001', 'Movie night pick', '🍿', 150, true),
 ('aaaaaaaa-0000-0000-0000-000000000032', 'aaaaaaaa-0000-0000-0000-000000000001', 'New Lego set', '🧱', 1500, true);
