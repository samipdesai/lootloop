-- LootLoop atomic functions + triggers (task #6, depended on by #18/#24/#32/#34).
--
-- Every money/state mutation that touches a balance + a ledger happens HERE, in
-- one transaction, as SECURITY DEFINER (owner = postgres, bypasses RLS). The
-- client never writes wallets / point_transactions / reward_purchases /
-- savings_transactions directly — those tables are read-only under RLS (002).
--
-- Invariants enforced:
--   * wallets.wallet_balance >= 0 and wallets.savings_balance >= 0 (CHECKs in
--     001 + explicit guards here so we reject with a clear error, not a CHECK
--     violation).
--   * No double-award: award is idempotent on completion status.
--   * No double-spend / races: the wallet row is locked FOR UPDATE before any
--     balance read, so concurrent calls serialize on that row.
--
-- search_path is pinned on every function to keep SECURITY DEFINER safe.


-- ===========================================================================
-- Wallet / streak bootstrap for new kid profiles.
--
-- A kid must always have a wallet (so balances are never missing) and a
-- reading_streak row. Trigger fires AFTER INSERT on profiles for role='kid'.
-- ===========================================================================
create or replace function ensure_kid_wallet_and_streak()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'kid' then
    insert into wallets (family_id, kid_id)
      values (new.family_id, new.id)
      on conflict (kid_id) do nothing;
    insert into reading_streaks (family_id, kid_id)
      values (new.family_id, new.id)
      on conflict (kid_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger profiles_ensure_kid_wallet_and_streak
  after insert on profiles
  for each row execute function ensure_kid_wallet_and_streak();


-- ===========================================================================
-- award_points_on_approval(completion_id, reviewer_id)   — task #18
--
-- Approving a chore_completion:
--   1. lock the completion row; if already 'approved', NO-OP (idempotent) and
--      return the existing ledger row id — re-approval never double-awards.
--   2. set status='approved', awarded_points, reviewed_by, reviewed_at.
--   3. write a positive point_transactions row (type 'earn').
--   4. increment the kid's wallets.wallet_balance.
--
-- Points awarded = the chore_instance.points snapshot for that completion.
--
-- Returns: the point_transactions.id of the earn row (existing one on re-approve).
-- Raises:  if completion not found; if it was 'rejected' (can't approve a
--          rejected completion — must be re-claimed first).
-- ===========================================================================
create or replace function award_points_on_approval(
  p_completion_id uuid,
  p_reviewer_id   uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completion  chore_completions%rowtype;
  v_points      integer;
  v_txn_id      uuid;
begin
  -- Lock the completion to serialize concurrent approvals of the same row.
  select * into v_completion
    from chore_completions
   where id = p_completion_id
   for update;

  if not found then
    raise exception 'chore_completion % not found', p_completion_id
      using errcode = 'no_data_found';
  end if;

  -- AUTHORIZATION (this function is SECURITY DEFINER and granted to
  -- authenticated, so it must gate the CALLER itself — auth.uid()/auth.jwt()
  -- still reflect the caller inside a definer function). Only a PARENT in the
  -- completion's family may approve. A kid must not approve anything, including
  -- their own completion.
  if not (auth_role() = 'parent' and auth_family_id() = v_completion.family_id) then
    raise exception 'only a parent in the family may approve completions'
      using errcode = 'insufficient_privilege';
  end if;

  -- Idempotent: approving an already-approved completion must not double-award.
  if v_completion.status = 'approved' then
    select id into v_txn_id
      from point_transactions
     where chore_completion_id = p_completion_id
       and type = 'earn'
     order by created_at
     limit 1;
    return v_txn_id;
  end if;

  if v_completion.status = 'rejected' then
    raise exception 'chore_completion % is rejected; cannot approve', p_completion_id
      using errcode = 'check_violation';
  end if;

  -- Points to award = the instance's snapshot.
  select ci.points into v_points
    from chore_instances ci
   where ci.id = v_completion.chore_instance_id;

  update chore_completions
     set status         = 'approved',
         awarded_points = v_points,
         reviewed_by    = p_reviewer_id,
         reviewed_at    = now()
   where id = p_completion_id;

  insert into point_transactions (family_id, kid_id, type, amount, note, chore_completion_id, awarded_by)
    values (v_completion.family_id, v_completion.kid_id, 'earn', v_points,
            'Chore approved', p_completion_id, p_reviewer_id)
    returning id into v_txn_id;

  update wallets
     set wallet_balance = wallet_balance + v_points
   where kid_id = v_completion.kid_id;

  return v_txn_id;
end;
$$;


-- ===========================================================================
-- purchase_reward(reward_id, kid_id)   — task #24
--
-- A kid buys a reward:
--   1. lock the kid's wallet row FOR UPDATE.
--   2. read the reward cost (must be active).
--   3. reject if wallet_balance < cost  (insufficient funds).
--   4. decrement wallet_balance by cost.
--   5. write a 'spend' ledger row (amount = -cost).
--   6. insert reward_purchases (status 'purchased') linked to the ledger row.
--
-- cost is snapshotted onto the purchase (reward.cost may change later).
--
-- Returns: the new reward_purchases.id.
-- Raises:  reward not found / inactive; insufficient funds; wallet missing.
-- ===========================================================================
create or replace function purchase_reward(
  p_reward_id uuid,
  p_kid_id    uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet    wallets%rowtype;
  v_reward    rewards%rowtype;
  v_txn_id    uuid;
  v_purchase_id uuid;
begin
  -- Lock the wallet first → serializes concurrent purchases (no double-spend).
  select * into v_wallet
    from wallets
   where kid_id = p_kid_id
   for update;

  if not found then
    raise exception 'wallet for kid % not found', p_kid_id
      using errcode = 'no_data_found';
  end if;

  -- AUTHORIZATION: caller must be in the kid's family AND be either that kid or
  -- a parent. Blocks other kids (same or cross family) and cross-family parents.
  if not (auth_family_id() = v_wallet.family_id
          and (auth_profile_id() = p_kid_id or auth_role() = 'parent')) then
    raise exception 'caller may not purchase on behalf of kid %', p_kid_id
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_reward
    from rewards
   where id = p_reward_id;

  if not found then
    raise exception 'reward % not found', p_reward_id
      using errcode = 'no_data_found';
  end if;

  if not v_reward.active then
    raise exception 'reward % is not active', p_reward_id
      using errcode = 'check_violation';
  end if;

  -- Reward and wallet must belong to the same family (defense in depth; the
  -- caller is gated by RLS but functions bypass it, so re-check here).
  if v_reward.family_id <> v_wallet.family_id then
    raise exception 'reward % and kid % are in different families', p_reward_id, p_kid_id
      using errcode = 'check_violation';
  end if;

  if v_wallet.wallet_balance < v_reward.cost then
    raise exception 'insufficient funds: balance % < cost %', v_wallet.wallet_balance, v_reward.cost
      using errcode = 'check_violation';
  end if;

  update wallets
     set wallet_balance = wallet_balance - v_reward.cost
   where kid_id = p_kid_id;

  insert into point_transactions (family_id, kid_id, type, amount, note)
    values (v_wallet.family_id, p_kid_id, 'spend', -v_reward.cost,
            'Reward purchase: ' || v_reward.title)
    returning id into v_txn_id;

  insert into reward_purchases (family_id, reward_id, kid_id, cost, status, point_transaction_id)
    values (v_wallet.family_id, p_reward_id, p_kid_id, v_reward.cost, 'purchased', v_txn_id)
    returning id into v_purchase_id;

  return v_purchase_id;
end;
$$;


-- ===========================================================================
-- transfer_to_savings(kid_id, amount, direction)   — task #32
--
-- Move points between the spendable wallet and savings.
--   direction = 'deposit'  : wallet -> savings  (requires wallet_balance  >= amount)
--   direction = 'withdraw' : savings -> wallet  (requires savings_balance >= amount)
-- Writes one savings_transactions row (deposit = +amount, withdraw = -amount).
--
-- amount must be > 0. Overdraft in either direction is rejected.
--
-- Returns: the new savings_transactions.id.
-- Raises:  bad direction; non-positive amount; insufficient funds either side.
-- ===========================================================================
create or replace function transfer_to_savings(
  p_kid_id    uuid,
  p_amount    integer,
  p_direction savings_txn_type
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet wallets%rowtype;
  v_txn_id uuid;
begin
  if p_direction not in ('deposit', 'withdraw') then
    raise exception 'direction must be deposit or withdraw, got %', p_direction
      using errcode = 'invalid_parameter_value';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive, got %', p_amount
      using errcode = 'check_violation';
  end if;

  select * into v_wallet
    from wallets
   where kid_id = p_kid_id
   for update;

  if not found then
    raise exception 'wallet for kid % not found', p_kid_id
      using errcode = 'no_data_found';
  end if;

  -- AUTHORIZATION: caller must be in the kid's family AND be either that kid or
  -- a parent. Blocks moving another kid's points (same or cross family).
  if not (auth_family_id() = v_wallet.family_id
          and (auth_profile_id() = p_kid_id or auth_role() = 'parent')) then
    raise exception 'caller may not transfer savings for kid %', p_kid_id
      using errcode = 'insufficient_privilege';
  end if;

  if p_direction = 'deposit' then
    if v_wallet.wallet_balance < p_amount then
      raise exception 'insufficient wallet balance: % < %', v_wallet.wallet_balance, p_amount
        using errcode = 'check_violation';
    end if;
    update wallets
       set wallet_balance  = wallet_balance  - p_amount,
           savings_balance = savings_balance + p_amount
     where kid_id = p_kid_id;
    insert into savings_transactions (family_id, kid_id, type, amount, note)
      values (v_wallet.family_id, p_kid_id, 'deposit', p_amount, 'Deposit to savings')
      returning id into v_txn_id;
  else  -- withdraw
    if v_wallet.savings_balance < p_amount then
      raise exception 'insufficient savings balance: % < %', v_wallet.savings_balance, p_amount
        using errcode = 'check_violation';
    end if;
    update wallets
       set savings_balance = savings_balance - p_amount,
           wallet_balance  = wallet_balance  + p_amount
     where kid_id = p_kid_id;
    insert into savings_transactions (family_id, kid_id, type, amount, note)
      values (v_wallet.family_id, p_kid_id, 'withdraw', -p_amount, 'Withdraw from savings')
      returning id into v_txn_id;
  end if;

  return v_txn_id;
end;
$$;


-- ===========================================================================
-- credit_interest(kid_id, amount)   — helper for task #34 (monthly interest cron)
--
-- Clean atomic seam for the interest Edge Function: credit `amount` points to
-- savings and write an 'interest' ledger row, under the wallet row lock. The
-- Edge Function computes the rate/amount (per the domain interest logic) and
-- calls this per kid. amount must be > 0. Kept here (not in the Edge Function)
-- so the balance+ledger write stays atomic and consistent with the other ops.
--
-- Returns: the new savings_transactions.id.
-- ===========================================================================
create or replace function credit_interest(
  p_kid_id uuid,
  p_amount integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet wallets%rowtype;
  v_txn_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'interest amount must be positive, got %', p_amount
      using errcode = 'check_violation';
  end if;

  select * into v_wallet
    from wallets
   where kid_id = p_kid_id
   for update;

  if not found then
    raise exception 'wallet for kid % not found', p_kid_id
      using errcode = 'no_data_found';
  end if;

  update wallets
     set savings_balance = savings_balance + p_amount
   where kid_id = p_kid_id;

  insert into savings_transactions (family_id, kid_id, type, amount, note)
    values (v_wallet.family_id, p_kid_id, 'interest', p_amount, 'Monthly interest')
    returning id into v_txn_id;

  return v_txn_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- Grants. These functions are SECURITY DEFINER (bypass RLS), so each one
-- authorizes the CALLER in-body using the auth_* helpers (auth.uid()/auth.jwt()
-- still reflect the caller inside a definer function). That in-function check —
-- not RLS, and not a trusted server tier — is the authorization boundary,
-- because the "service layer" here is the client calling PostgREST RPC directly.
--
--   * award_points_on_approval / purchase_reward / transfer_to_savings:
--     callable by `authenticated`; each gates parent/owning-kid + family in-body.
--   * credit_interest: the monthly-interest cron seam. It has NO in-body caller
--     gate (it would have to encode "is the cron"), so it is NOT granted to
--     authenticated — only service_role / postgres (the Edge Function's service
--     role) may execute it. A kid/parent client calling it fails at permission
--     time before any logic runs.
--
-- anon is never granted EXECUTE on any of these.
-- ---------------------------------------------------------------------------
revoke all on function award_points_on_approval(uuid, uuid) from public;
revoke all on function purchase_reward(uuid, uuid)          from public;
revoke all on function transfer_to_savings(uuid, integer, savings_txn_type) from public;
revoke all on function credit_interest(uuid, integer)       from public;

grant execute on function award_points_on_approval(uuid, uuid) to authenticated;
grant execute on function purchase_reward(uuid, uuid)          to authenticated;
grant execute on function transfer_to_savings(uuid, integer, savings_txn_type) to authenticated;
-- credit_interest: service_role only (cron Edge Function). Do NOT grant to authenticated.
grant execute on function credit_interest(uuid, integer)       to service_role;
