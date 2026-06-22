-- Deterministic seed for the Maestro kid reading + savings flow (task #47 / M4).
-- Postgres superuser. Idempotent: wipes + recreates a dedicated test family.
-- Code MAESTRO7 / kid Ava / PIN 1234, wallet 100 (so the savings deposit has loot
-- to move), savings 0.
set search_path = public, extensions;

delete from families where name = 'Maestro Test Family';

insert into families (id, name, kid_code)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Maestro Test Family', 'MAESTRO7');

insert into profiles (id, family_id, role, display_name, pin_hash, age_mode)
values (
  'aaaaaaaa-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'kid', 'Ava', crypt('1234', gen_salt('bf', 10)), 'detailed'
);

update wallets set wallet_balance = 100
 where kid_id = 'aaaaaaaa-0000-0000-0000-000000000002';
