-- LootLoop initial schema (task #5): all tables + indexes only.
-- RLS policies and atomic SQL functions are OUT of scope here — see task #6 (002_rls_policies.sql)
-- and 003_functions_and_triggers.sql.
--
-- Conventions:
--   * uuid primary keys (gen_random_uuid()).
--   * Every family-scoped table carries family_id -> families(id) for RLS keying in task #6.
--   * Money / points are INTEGER. Never floats.
--   * created_at / updated_at timestamptz on every table.
--   * Enums for role / age_mode / status / transaction-type.
--   * Parents are Supabase Auth users (auth.users); kids authenticate via PIN (Edge Function, task #9)
--     and are NOT auth users — both live in the single `profiles` table, discriminated by `role`.

-- gen_random_uuid() lives in pgcrypto (available by default on Supabase, but be explicit).
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type profile_role        as enum ('parent', 'kid');
create type age_mode            as enum ('simple', 'detailed', 'teen'); -- 5-8 / 9-12 / 13-15
create type chore_assignment    as enum ('assigned', 'shared');        -- specific kid vs claimable
create type completion_status   as enum ('claimed', 'pending', 'approved', 'rejected');
create type reading_status      as enum ('pending', 'approved', 'rejected');
create type purchase_status     as enum ('purchased', 'given');
create type point_txn_type      as enum ('earn', 'bonus', 'spend', 'refund');
create type savings_txn_type    as enum ('deposit', 'withdraw', 'interest');

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger function
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- families — the isolation root
-- ---------------------------------------------------------------------------
create table families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger families_set_updated_at
  before update on families
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- profiles — parents and kids in a family.
--   * Parents: auth_user_id set (FK to auth.users), pin_hash / age_mode null.
--   * Kids:    pin_hash + age_mode set, auth_user_id null.
-- ---------------------------------------------------------------------------
create table profiles (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families (id) on delete cascade,
  role          profile_role not null,
  display_name  text not null check (char_length(display_name) between 1 and 60),
  avatar_url    text,

  -- Parent-only: link to Supabase Auth. Kids do not have an auth.users row.
  auth_user_id  uuid unique references auth.users (id) on delete cascade,

  -- Kid-only: PIN credential (hashed, never plaintext) + age-mode UI variant.
  pin_hash      text,
  age_mode      age_mode,
  birthdate     date,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- A parent has an auth user and no kid-only fields; a kid has a pin + age_mode and no auth user.
  constraint profiles_parent_shape check (
    role <> 'parent' or (auth_user_id is not null and pin_hash is null and age_mode is null)
  ),
  constraint profiles_kid_shape check (
    role <> 'kid' or (auth_user_id is null and pin_hash is not null and age_mode is not null)
  )
);
create index profiles_family_id_idx     on profiles (family_id);
create index profiles_family_role_idx   on profiles (family_id, role);
create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- chores — the parent-authored definition (template). Instances are materialized
-- per day by the recurring-chore generator (task #14).
-- ---------------------------------------------------------------------------
create table chores (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references families (id) on delete cascade,
  title             text not null check (char_length(title) between 1 and 120),
  icon              text,                                  -- lucide icon name (design uses these)
  points            integer not null check (points >= 0),
  assignment        chore_assignment not null default 'assigned',
  -- For assignment='assigned': the kid responsible. For 'shared': null (claimable by any kid).
  assigned_kid_id   uuid references profiles (id) on delete cascade,
  -- Recurrence rule (iCal RRULE string or null for one-off). Parsed by the generator, not the DB.
  recurrence_rule   text,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint chores_assigned_has_kid check (
    (assignment = 'assigned' and assigned_kid_id is not null)
    or (assignment = 'shared' and assigned_kid_id is null)
  )
);
create index chores_family_id_idx       on chores (family_id);
create index chores_assigned_kid_idx    on chores (assigned_kid_id);
create index chores_family_active_idx   on chores (family_id, active);
create trigger chores_set_updated_at
  before update on chores
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- chore_instances — materialized occurrences for a specific date (task #14 generator).
-- This is the unit a kid actually sees and completes.
-- ---------------------------------------------------------------------------
create table chore_instances (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families (id) on delete cascade,
  chore_id    uuid not null references chores (id) on delete cascade,
  due_date    date not null,
  -- Snapshot of points at generation time (chore.points can change later).
  points      integer not null check (points >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- One instance per chore per day (idempotent generator).
  constraint chore_instances_unique unique (chore_id, due_date)
);
create index chore_instances_family_id_idx    on chore_instances (family_id);
create index chore_instances_due_date_idx     on chore_instances (family_id, due_date);
create trigger chore_instances_set_updated_at
  before update on chore_instances
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- chore_completions — lifecycle: claimed -> pending -> approved | rejected.
-- A kid claims/completes a chore_instance; parent approves (awards points via task #18).
-- ---------------------------------------------------------------------------
create table chore_completions (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references families (id) on delete cascade,
  chore_instance_id   uuid not null references chore_instances (id) on delete cascade,
  kid_id              uuid not null references profiles (id) on delete cascade,
  status              completion_status not null default 'pending',
  -- Points actually awarded on approval (snapshot; set by the approval function in task #18).
  awarded_points      integer check (awarded_points >= 0),
  reviewed_by         uuid references profiles (id) on delete set null, -- parent who approved/rejected
  claimed_at          timestamptz,
  submitted_at        timestamptz not null default now(),
  reviewed_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- One active completion per kid per instance.
  constraint chore_completions_unique unique (chore_instance_id, kid_id)
);
create index chore_completions_family_id_idx     on chore_completions (family_id);
create index chore_completions_kid_id_idx        on chore_completions (kid_id);
create index chore_completions_status_idx        on chore_completions (family_id, status);
create trigger chore_completions_set_updated_at
  before update on chore_completions
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- wallets — current balances per kid. Wallet (spendable) vs savings are separate balances.
-- Mutated only by atomic SQL functions (task #18/#24/#32/#34); ledgers below are the source of truth.
-- ---------------------------------------------------------------------------
create table wallets (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references families (id) on delete cascade,
  kid_id           uuid not null unique references profiles (id) on delete cascade,
  wallet_balance   integer not null default 0 check (wallet_balance >= 0),
  savings_balance  integer not null default 0 check (savings_balance >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index wallets_family_id_idx on wallets (family_id);
create trigger wallets_set_updated_at
  before update on wallets
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- point_transactions — append-only ledger for the spendable wallet.
--   earn (chore/reading approval), bonus (parent ad-hoc + note), spend (reward purchase), refund.
-- amount is signed: positive for earn/bonus/refund, negative for spend.
-- ---------------------------------------------------------------------------
create table point_transactions (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families (id) on delete cascade,
  kid_id      uuid not null references profiles (id) on delete cascade,
  type        point_txn_type not null,
  amount      integer not null check (amount <> 0),
  note        text,
  -- Optional provenance links (no FK fan-out beyond the obvious sources).
  chore_completion_id  uuid references chore_completions (id) on delete set null,
  awarded_by           uuid references profiles (id) on delete set null, -- parent, for bonus
  created_at  timestamptz not null default now()
);
create index point_transactions_family_id_idx    on point_transactions (family_id);
create index point_transactions_kid_id_idx       on point_transactions (kid_id, created_at desc);

-- ---------------------------------------------------------------------------
-- rewards — parent-authored catalog items with a point cost.
-- ---------------------------------------------------------------------------
create table rewards (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  emoji       text,
  image_url   text,
  cost        integer not null check (cost >= 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index rewards_family_id_idx      on rewards (family_id);
create index rewards_family_active_idx  on rewards (family_id, active);
create trigger rewards_set_updated_at
  before update on rewards
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- reward_purchases — a kid bought a reward; fulfillment: purchased -> given.
-- cost is snapshotted (reward.cost can change later).
-- ---------------------------------------------------------------------------
create table reward_purchases (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families (id) on delete cascade,
  reward_id       uuid not null references rewards (id) on delete restrict,
  kid_id          uuid not null references profiles (id) on delete cascade,
  cost            integer not null check (cost >= 0),
  status          purchase_status not null default 'purchased',
  -- Links the spend ledger row created by purchase_reward() (task #24).
  point_transaction_id  uuid references point_transactions (id) on delete set null,
  given_by        uuid references profiles (id) on delete set null,
  purchased_at    timestamptz not null default now(),
  given_at        timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index reward_purchases_family_id_idx    on reward_purchases (family_id);
create index reward_purchases_kid_id_idx       on reward_purchases (kid_id);
create index reward_purchases_status_idx       on reward_purchases (family_id, status);
create trigger reward_purchases_set_updated_at
  before update on reward_purchases
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- reading_logs — kid logs minutes + book title; approval lifecycle awards points.
-- ---------------------------------------------------------------------------
create table reading_logs (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families (id) on delete cascade,
  kid_id          uuid not null references profiles (id) on delete cascade,
  book_title      text not null check (char_length(book_title) between 1 and 200),
  minutes         integer not null check (minutes > 0),
  read_on         date not null default current_date,   -- the day this reading counts toward
  status          reading_status not null default 'pending',
  awarded_points  integer check (awarded_points >= 0),
  reviewed_by     uuid references profiles (id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index reading_logs_family_id_idx    on reading_logs (family_id);
create index reading_logs_kid_id_idx       on reading_logs (kid_id, read_on desc);
create index reading_logs_status_idx       on reading_logs (family_id, status);
create trigger reading_logs_set_updated_at
  before update on reading_logs
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- reading_streaks — one row per kid: current + longest streak (task #29).
-- ---------------------------------------------------------------------------
create table reading_streaks (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references families (id) on delete cascade,
  kid_id              uuid not null unique references profiles (id) on delete cascade,
  current_streak      integer not null default 0 check (current_streak >= 0),
  longest_streak      integer not null default 0 check (longest_streak >= 0),
  last_read_date      date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index reading_streaks_family_id_idx on reading_streaks (family_id);
create trigger reading_streaks_set_updated_at
  before update on reading_streaks
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- savings_transactions — append-only ledger for the savings balance.
--   deposit (wallet -> savings), withdraw (savings -> wallet), interest (monthly cron, task #34).
-- amount is signed: positive = into savings (deposit/interest), negative = out (withdraw).
-- ---------------------------------------------------------------------------
create table savings_transactions (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families (id) on delete cascade,
  kid_id      uuid not null references profiles (id) on delete cascade,
  type        savings_txn_type not null,
  amount      integer not null check (amount <> 0),
  note        text,
  created_at  timestamptz not null default now()
);
create index savings_transactions_family_id_idx on savings_transactions (family_id);
create index savings_transactions_kid_id_idx    on savings_transactions (kid_id, created_at desc);

-- ---------------------------------------------------------------------------
-- savings_goals — a kid's named savings target (backs the design's GoalTracker).
-- Progress is derived from wallets.savings_balance at read time, not stored here.
-- ---------------------------------------------------------------------------
create table savings_goals (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families (id) on delete cascade,
  kid_id        uuid not null references profiles (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 120),
  emoji         text,
  -- Points needed to reach the goal.
  target        integer not null check (target > 0),
  achieved_at   timestamptz,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index savings_goals_family_id_idx  on savings_goals (family_id);
create index savings_goals_kid_id_idx      on savings_goals (kid_id);
create trigger savings_goals_set_updated_at
  before update on savings_goals
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- schedule_items — time-based daily items per kid (task #36/#37 timeline).
-- ---------------------------------------------------------------------------
create table schedule_items (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families (id) on delete cascade,
  kid_id        uuid not null references profiles (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 120),
  icon          text,
  start_time    time not null,
  end_time      time,
  -- Days of week this item recurs on: ISO 1=Mon .. 7=Sun. Empty = every day.
  days_of_week  smallint[] not null default '{}'::smallint[],
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint schedule_items_time_order check (end_time is null or end_time > start_time)
);
create index schedule_items_family_id_idx   on schedule_items (family_id);
create index schedule_items_kid_id_idx       on schedule_items (kid_id);
create trigger schedule_items_set_updated_at
  before update on schedule_items
  for each row execute function set_updated_at();
