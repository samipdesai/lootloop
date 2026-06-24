-- Rich, attractive seed for App Store screenshot capture (#58). Superuser/local.
-- Family MAESTRO7 + kid Ava / PIN 1234 (same login as the kid flows) but with a
-- healthy wallet, savings, reading streak, several chores, store rewards, and a
-- savings goal — so Home / Store / Savings / Reading all look populated.
set search_path = public, extensions;

delete from families where name = 'Maestro Test Family';

insert into families (id, name, kid_code)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Maestro Test Family', 'MAESTRO7');

-- Kid Ava (wallet + reading_streak auto-created by trigger).
insert into profiles (id, family_id, role, display_name, pin_hash, age_mode)
values ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
        'kid', 'Ava', crypt('1234', gen_salt('bf', 10)), 'detailed');

-- Healthy balances + an active reading streak for nice hero numbers.
update wallets set wallet_balance = 850, savings_balance = 320
  where kid_id = 'aaaaaaaa-0000-0000-0000-000000000002';
update reading_streaks set current_streak = 5, longest_streak = 12, last_read_date = current_date
  where kid_id = 'aaaaaaaa-0000-0000-0000-000000000002';

-- Four chores with friendly icons, assigned to Ava.
insert into chores (id, family_id, title, icon, points, assignment, assigned_kid_id, active) values
 ('aaaaaaaa-0000-0000-0000-000000000010','aaaaaaaa-0000-0000-0000-000000000001','Make your bed','bed',10,'assigned','aaaaaaaa-0000-0000-0000-000000000002',true),
 ('aaaaaaaa-0000-0000-0000-000000000011','aaaaaaaa-0000-0000-0000-000000000001','Feed the dog','dog',15,'assigned','aaaaaaaa-0000-0000-0000-000000000002',true),
 ('aaaaaaaa-0000-0000-0000-000000000012','aaaaaaaa-0000-0000-0000-000000000001','Clear the table','utensils',10,'assigned','aaaaaaaa-0000-0000-0000-000000000002',true),
 ('aaaaaaaa-0000-0000-0000-000000000013','aaaaaaaa-0000-0000-0000-000000000001','Tidy your room','sparkles',20,'assigned','aaaaaaaa-0000-0000-0000-000000000002',true);

-- Materialize each chore for yesterday/today/tomorrow (UTC) so exactly one row
-- matches the device's local "today" regardless of timezone.
insert into chore_instances (id, family_id, chore_id, due_date, points)
select gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', c.id, t.d, c.points
from (values
  ('aaaaaaaa-0000-0000-0000-000000000010'::uuid, 10),
  ('aaaaaaaa-0000-0000-0000-000000000011'::uuid, 15),
  ('aaaaaaaa-0000-0000-0000-000000000012'::uuid, 10),
  ('aaaaaaaa-0000-0000-0000-000000000013'::uuid, 20)
) as c(id, points),
(values (current_date - 1), (current_date), (current_date + 1)) as t(d);

-- A reward store the kid wants.
insert into rewards (family_id, title, emoji, cost, active) values
 ('aaaaaaaa-0000-0000-0000-000000000001','Extra screen time','📱',150,true),
 ('aaaaaaaa-0000-0000-0000-000000000001','Ice cream trip','🍦',300,true),
 ('aaaaaaaa-0000-0000-0000-000000000001','Movie night pick','🎬',250,true),
 ('aaaaaaaa-0000-0000-0000-000000000001','$5 allowance','💵',500,true);

-- A savings goal to show progress on the Savings screen.
insert into savings_goals (family_id, kid_id, title, emoji, target, active) values
 ('aaaaaaaa-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000002','New LEGO set','🧱',800,true);
