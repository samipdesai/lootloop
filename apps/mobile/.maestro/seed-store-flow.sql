-- Deterministic seed for the Maestro kid STORE flow (task #47 / M3).
-- Postgres superuser (bypasses RLS). Idempotent: wipes + recreates a dedicated
-- test family so each run starts clean (reward affordable, no prior purchase).
-- Fixed code MAESTRO7 / kid Ava / PIN 1234, balance 100, one reward costing 70 —
-- so after one purchase the balance (30) can no longer afford it, giving the flow
-- a durable post-purchase assertion ("Need 🪙 40 more").
set search_path = public, extensions;

delete from families where name = 'Maestro Test Family';

insert into families (id, name, kid_code)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Maestro Test Family', 'MAESTRO7');

-- Kid Ava (PIN 1234). The ensure_kid_wallet_and_streak trigger auto-creates her
-- wallet (balance 0) in this same transaction.
insert into profiles (id, family_id, role, display_name, pin_hash, age_mode)
values (
  'aaaaaaaa-0000-0000-0000-000000000002',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'kid', 'Ava', crypt('1234', gen_salt('bf', 10)), 'simple'
);

-- Give Ava spendable loot (set directly for the test — bypasses the atomic fn).
update wallets set wallet_balance = 100
 where kid_id = 'aaaaaaaa-0000-0000-0000-000000000002';

-- One active reward she can afford exactly once (cost 70 → 30 left < 70).
insert into rewards (id, family_id, title, emoji, cost, active)
values (
  'aaaaaaaa-0000-0000-0000-000000000005',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Ice cream Sundae', '🍦', 70, true
);
