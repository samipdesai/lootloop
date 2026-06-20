-- LootLoop RLS policies (task #6): enable + enforce Row Level Security on every
-- family-scoped table so the database — not app code — guarantees family isolation.
--
-- =============================================================================
-- PRINCIPAL / FAMILY-RESOLUTION MODEL  (read this first)
-- =============================================================================
-- There are TWO kinds of authenticated principal, and they identify themselves
-- differently. The helper functions below resolve BOTH to (family_id, role,
-- profile_id) so every policy can be written once against those helpers.
--
--   1. PARENT  — a real Supabase Auth user (row in auth.users).
--      * The JWT is a standard Supabase Auth token; `auth.uid()` returns the
--        auth user id. We look that up in profiles.auth_user_id to get the
--        parent's family_id / profile id. role is always 'parent'.
--      * Parent JWTs do NOT carry custom lootloop claims.
--
--   2. KID  — NOT an auth.users row. Kids log in by PIN via the kid-auth Edge
--      Function (task #9), which mints a JWT carrying CUSTOM CLAIMS that this
--      migration's helpers read via auth.jwt().
--
-- -----------------------------------------------------------------------------
-- KID JWT CLAIM CONTRACT  (task #9 MUST mint tokens that honor this exactly)
-- -----------------------------------------------------------------------------
-- The kid-auth Edge Function must sign a JWT (with the project JWT secret, alg
-- HS256) whose payload includes:
--
--     {
--       "role":       "authenticated",   -- Postgres role PostgREST switches to
--       "ll_role":    "kid",             -- LootLoop principal kind: 'kid'
--       "family_id":  "<uuid>",          -- profiles.family_id of the kid
--       "profile_id": "<uuid>",          -- profiles.id of the kid
--       "sub":        "<profiles.id>",   -- (recommended) kid profile id; NOT an auth.users id
--       "aud":        "authenticated",
--       "exp":        <unix ts>          -- short-lived (e.g. 30 days max)
--     }
--
-- Notes for task #9:
--   * Use the namespaced claim `ll_role` (NOT the bare `role`, which Postgres/
--     PostgREST reserves for the DB role and must stay "authenticated"). The
--     helpers below treat ll_role='kid' as "this is a kid session".
--   * `family_id` and `profile_id` are top-level claims (not nested) so
--     auth.jwt() ->> 'family_id' resolves them directly.
--   * Parent tokens come from Supabase Auth and will have ll_role absent →
--     helpers fall back to the auth.uid()→profiles lookup.
--   * The Edge Function verifies the PIN against profiles.pin_hash BEFORE
--     minting; nothing here re-checks the PIN. The DB trusts a validly-signed
--     JWT's claims (signature is verified by PostgREST/GoTrue upstream).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Auth-context helpers.
--
-- SECURITY DEFINER so they can read profiles regardless of the caller's own
-- RLS (otherwise a parent resolving their own family_id would recurse into the
-- profiles policy). STABLE: result is constant within a statement. search_path
-- pinned to defeat search_path hijacking on SECURITY DEFINER functions.
-- ---------------------------------------------------------------------------

-- Is the current principal a kid? (kid JWT carries ll_role='kid')
create or replace function auth_is_kid()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(auth.jwt() ->> 'll_role', '') = 'kid';
$$;

-- The current principal's LootLoop role: 'kid' from the JWT claim, otherwise
-- 'parent' resolved from the auth.users → profiles link. NULL if neither
-- (unauthenticated / unknown principal).
create or replace function auth_role()
returns profile_role
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  r profile_role;
begin
  if auth_is_kid() then
    return 'kid'::profile_role;
  end if;
  select p.role into r
    from profiles p
   where p.auth_user_id = auth.uid()
   limit 1;
  return r;  -- null when no matching parent profile
end;
$$;

-- The current principal's profile id.
--   * kid:    profile_id claim
--   * parent: profiles.id for the row whose auth_user_id = auth.uid()
create or replace function auth_profile_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  pid uuid;
begin
  if auth_is_kid() then
    return nullif(auth.jwt() ->> 'profile_id', '')::uuid;
  end if;
  select p.id into pid
    from profiles p
   where p.auth_user_id = auth.uid()
   limit 1;
  return pid;
end;
$$;

-- The current principal's family id — the keystone of all isolation policies.
--   * kid:    family_id claim
--   * parent: profiles.family_id for the row whose auth_user_id = auth.uid()
create or replace function auth_family_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  fid uuid;
begin
  if auth_is_kid() then
    return nullif(auth.jwt() ->> 'family_id', '')::uuid;
  end if;
  select p.family_id into fid
    from profiles p
   where p.auth_user_id = auth.uid()
   limit 1;
  return fid;
end;
$$;

revoke all on function auth_is_kid()     from public;
revoke all on function auth_role()       from public;
revoke all on function auth_profile_id() from public;
revoke all on function auth_family_id()  from public;
grant execute on function auth_is_kid()     to authenticated, anon;
grant execute on function auth_role()       to authenticated, anon;
grant execute on function auth_profile_id() to authenticated, anon;
grant execute on function auth_family_id()  to authenticated, anon;


-- ---------------------------------------------------------------------------
-- Base table privileges for the PostgREST roles.
--
-- RLS only FILTERS rows the role is otherwise allowed to touch; without table-
-- level GRANTs the `authenticated` role can't reach the tables at all (and RLS
-- would be moot). We grant the privileges each table's policies actually use to
-- `authenticated`; the policies (below) constrain WHICH rows. `anon` gets
-- nothing on family data — unauthenticated callers see no family rows.
--
-- Grants are intentionally coarse (per-table SELECT/INSERT/UPDATE/DELETE); the
-- row-level policies are the real authorization boundary. Tables that are
-- read-only to clients (wallets, ledgers, streaks) get SELECT only, so even a
-- bug in a policy can't let a client write a balance — the privilege isn't there.
-- ---------------------------------------------------------------------------
grant select                         on families             to authenticated;
grant select, insert, update, delete on profiles             to authenticated;
grant select, insert, update, delete on chores               to authenticated;
grant select, insert, update, delete on chore_instances      to authenticated;
grant select, insert, update         on chore_completions    to authenticated;
grant select                         on wallets              to authenticated;
grant select                         on point_transactions   to authenticated;
grant select, insert, update, delete on rewards              to authenticated;
grant select, update                 on reward_purchases     to authenticated;
grant select, insert, update         on reading_logs         to authenticated;
grant select                         on reading_streaks      to authenticated;
grant select                         on savings_transactions to authenticated;
grant select, insert, update, delete on savings_goals        to authenticated;
grant select, insert, update, delete on schedule_items       to authenticated;


-- ---------------------------------------------------------------------------
-- Enable RLS on every family-scoped table. (families is the isolation root.)
-- With RLS on and no policy, a table denies all access by default — so every
-- table below gets explicit policies.
-- ---------------------------------------------------------------------------
alter table families             enable row level security;
alter table profiles             enable row level security;
alter table chores               enable row level security;
alter table chore_instances      enable row level security;
alter table chore_completions    enable row level security;
alter table wallets              enable row level security;
alter table point_transactions   enable row level security;
alter table rewards              enable row level security;
alter table reward_purchases     enable row level security;
alter table reading_logs         enable row level security;
alter table reading_streaks      enable row level security;
alter table savings_transactions enable row level security;
alter table savings_goals        enable row level security;
alter table schedule_items       enable row level security;


-- =============================================================================
-- POLICIES
--
-- General shape:
--   * Isolation: every policy requires family_id = auth_family_id() (and for
--     `families` itself, id = auth_family_id()).
--   * Role boundary: parents manage the family (chores, rewards, approvals,
--     schedule, all kids); kids see their own ledgers/wallet/reading/savings
--     and the family's reward catalog, but CANNOT directly mutate balances or
--     ledgers — those move only through the SECURITY DEFINER atomic functions
--     in 003 (which run as the function owner and bypass these write policies).
--
-- "Kid owns the row" == kid_id = auth_profile_id().
-- =============================================================================

-- ---------- families ----------
-- Read your own family. No client writes (families are created/edited via the
-- signup/onboarding flow under elevated context, not direct table DML).
create policy families_select on families
  for select using (id = auth_family_id());


-- ---------- profiles ----------
-- Everyone in a family can SEE everyone in that family (kid roster, parent
-- names, avatars). Parents manage profiles (add/edit/remove kids & co-parents);
-- a kid may update only their own profile row (e.g. avatar) and cannot insert
-- or delete profiles or change family_id/role (guarded by parents-only DML +
-- the kid update policy scoping to their own row).
create policy profiles_select on profiles
  for select using (family_id = auth_family_id());

create policy profiles_parent_insert on profiles
  for insert with check (family_id = auth_family_id() and auth_role() = 'parent');

create policy profiles_parent_update on profiles
  for update using (family_id = auth_family_id() and auth_role() = 'parent')
          with check (family_id = auth_family_id());

create policy profiles_kid_update_self on profiles
  for update using (family_id = auth_family_id() and id = auth_profile_id() and auth_role() = 'kid')
          with check (family_id = auth_family_id() and id = auth_profile_id());

create policy profiles_parent_delete on profiles
  for delete using (family_id = auth_family_id() and auth_role() = 'parent');


-- ---------- chores (parent-authored templates) ----------
-- Whole family reads (kids need to see what's assigned/claimable). Only parents
-- author/maintain chores.
create policy chores_select on chores
  for select using (family_id = auth_family_id());

create policy chores_parent_insert on chores
  for insert with check (family_id = auth_family_id() and auth_role() = 'parent');

create policy chores_parent_update on chores
  for update using (family_id = auth_family_id() and auth_role() = 'parent')
          with check (family_id = auth_family_id());

create policy chores_parent_delete on chores
  for delete using (family_id = auth_family_id() and auth_role() = 'parent');


-- ---------- chore_instances (materialized occurrences) ----------
-- Whole family reads. Written by the generator Edge Function (task #14) and
-- parents; kids never create instances.
create policy chore_instances_select on chore_instances
  for select using (family_id = auth_family_id());

create policy chore_instances_parent_insert on chore_instances
  for insert with check (family_id = auth_family_id() and auth_role() = 'parent');

create policy chore_instances_parent_update on chore_instances
  for update using (family_id = auth_family_id() and auth_role() = 'parent')
          with check (family_id = auth_family_id());

create policy chore_instances_parent_delete on chore_instances
  for delete using (family_id = auth_family_id() and auth_role() = 'parent');


-- ---------- chore_completions ----------
-- A kid claims/completes a chore_instance: they may INSERT their own completion
-- and UPDATE it while it is still claimed/pending (e.g. mark complete / undo).
-- Parents see all and review (approve/reject) — the approval that AWARDS POINTS
-- runs through award_points_on_approval() (003), not raw UPDATE. Parents may
-- also UPDATE directly (e.g. reject). Nobody hard-deletes completions via the
-- client.
create policy chore_completions_select on chore_completions
  for select using (
    family_id = auth_family_id()
    and (auth_role() = 'parent' or kid_id = auth_profile_id())
  );

create policy chore_completions_kid_insert on chore_completions
  for insert with check (
    family_id = auth_family_id()
    and auth_role() = 'kid'
    and kid_id = auth_profile_id()
  );

-- Kid may edit only their own, and only while not yet decided.
create policy chore_completions_kid_update on chore_completions
  for update using (
    family_id = auth_family_id()
    and auth_role() = 'kid'
    and kid_id = auth_profile_id()
    and status in ('claimed', 'pending')
  )
  with check (
    family_id = auth_family_id()
    and kid_id = auth_profile_id()
    and status in ('claimed', 'pending')
  );

create policy chore_completions_parent_update on chore_completions
  for update using (family_id = auth_family_id() and auth_role() = 'parent')
          with check (family_id = auth_family_id());


-- ---------- wallets ----------
-- READ-ONLY at the table level for everyone: balances move ONLY through the
-- atomic SECURITY DEFINER functions in 003. Kids read their own wallet; parents
-- read all wallets in the family. No INSERT/UPDATE/DELETE policy exists, so all
-- direct client writes are denied — the functions (owned by postgres) bypass
-- RLS and are the sole mutators.
create policy wallets_select on wallets
  for select using (
    family_id = auth_family_id()
    and (auth_role() = 'parent' or kid_id = auth_profile_id())
  );


-- ---------- point_transactions (append-only ledger) ----------
-- READ-ONLY at the table level: rows are written only by the atomic functions
-- (earn on approval, spend on purchase, etc.). Kids read their own ledger;
-- parents read the whole family's.
create policy point_transactions_select on point_transactions
  for select using (
    family_id = auth_family_id()
    and (auth_role() = 'parent' or kid_id = auth_profile_id())
  );


-- ---------- rewards (parent-authored catalog) ----------
-- Whole family reads the catalog (kids browse to buy). Only parents maintain it.
create policy rewards_select on rewards
  for select using (family_id = auth_family_id());

create policy rewards_parent_insert on rewards
  for insert with check (family_id = auth_family_id() and auth_role() = 'parent');

create policy rewards_parent_update on rewards
  for update using (family_id = auth_family_id() and auth_role() = 'parent')
          with check (family_id = auth_family_id());

create policy rewards_parent_delete on rewards
  for delete using (family_id = auth_family_id() and auth_role() = 'parent');


-- ---------- reward_purchases ----------
-- Rows are CREATED by purchase_reward() (003), not by direct client INSERT — so
-- no INSERT policy. Kids read their own purchases; parents read all and may
-- UPDATE fulfillment (status purchased -> given).
create policy reward_purchases_select on reward_purchases
  for select using (
    family_id = auth_family_id()
    and (auth_role() = 'parent' or kid_id = auth_profile_id())
  );

create policy reward_purchases_parent_update on reward_purchases
  for update using (family_id = auth_family_id() and auth_role() = 'parent')
          with check (family_id = auth_family_id());


-- ---------- reading_logs ----------
-- A kid logs their own reading (INSERT) and may edit it while still pending.
-- Parents see all and review (approve/reject); the points-awarding approval
-- path mirrors chores (handled in app/edge logic atop the same ledger funcs).
create policy reading_logs_select on reading_logs
  for select using (
    family_id = auth_family_id()
    and (auth_role() = 'parent' or kid_id = auth_profile_id())
  );

create policy reading_logs_kid_insert on reading_logs
  for insert with check (
    family_id = auth_family_id()
    and auth_role() = 'kid'
    and kid_id = auth_profile_id()
  );

create policy reading_logs_kid_update on reading_logs
  for update using (
    family_id = auth_family_id()
    and auth_role() = 'kid'
    and kid_id = auth_profile_id()
    and status = 'pending'
  )
  with check (
    family_id = auth_family_id()
    and kid_id = auth_profile_id()
    and status = 'pending'
  );

create policy reading_logs_parent_update on reading_logs
  for update using (family_id = auth_family_id() and auth_role() = 'parent')
          with check (family_id = auth_family_id());


-- ---------- reading_streaks ----------
-- READ-ONLY at the table level: maintained by streak logic (task #29) running
-- under elevated context. Kids read their own; parents read the family's.
create policy reading_streaks_select on reading_streaks
  for select using (
    family_id = auth_family_id()
    and (auth_role() = 'parent' or kid_id = auth_profile_id())
  );


-- ---------- savings_transactions (append-only ledger) ----------
-- READ-ONLY at the table level: rows written only by transfer_to_savings() and
-- the interest function (003 / task #34). Kids read their own; parents read all.
create policy savings_transactions_select on savings_transactions
  for select using (
    family_id = auth_family_id()
    and (auth_role() = 'parent' or kid_id = auth_profile_id())
  );


-- ---------- savings_goals ----------
-- A kid owns and manages their own savings goals (create/edit/delete). Parents
-- can see (and adjust) all goals in the family.
create policy savings_goals_select on savings_goals
  for select using (
    family_id = auth_family_id()
    and (auth_role() = 'parent' or kid_id = auth_profile_id())
  );

create policy savings_goals_kid_write_insert on savings_goals
  for insert with check (
    family_id = auth_family_id()
    and auth_role() = 'kid'
    and kid_id = auth_profile_id()
  );

create policy savings_goals_kid_write_update on savings_goals
  for update using (
    family_id = auth_family_id()
    and auth_role() = 'kid'
    and kid_id = auth_profile_id()
  )
  with check (
    family_id = auth_family_id()
    and kid_id = auth_profile_id()
  );

create policy savings_goals_kid_write_delete on savings_goals
  for delete using (
    family_id = auth_family_id()
    and auth_role() = 'kid'
    and kid_id = auth_profile_id()
  );

create policy savings_goals_parent_insert on savings_goals
  for insert with check (family_id = auth_family_id() and auth_role() = 'parent');

create policy savings_goals_parent_update on savings_goals
  for update using (family_id = auth_family_id() and auth_role() = 'parent')
          with check (family_id = auth_family_id());

create policy savings_goals_parent_delete on savings_goals
  for delete using (family_id = auth_family_id() and auth_role() = 'parent');


-- ---------- schedule_items ----------
-- Parents author each kid's daily timeline; whole family reads.
create policy schedule_items_select on schedule_items
  for select using (family_id = auth_family_id());

create policy schedule_items_parent_insert on schedule_items
  for insert with check (family_id = auth_family_id() and auth_role() = 'parent');

create policy schedule_items_parent_update on schedule_items
  for update using (family_id = auth_family_id() and auth_role() = 'parent')
          with check (family_id = auth_family_id());

create policy schedule_items_parent_delete on schedule_items
  for delete using (family_id = auth_family_id() and auth_role() = 'parent');
