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
