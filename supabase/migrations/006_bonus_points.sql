-- LootLoop atomic bonus-points award (task #21).
--
-- A parent gives ad-hoc BONUS points to a kid with an optional note. Like the
-- other money/state mutations (003), the balance + ledger write happens HERE in
-- one transaction as SECURITY DEFINER (owner = postgres, bypasses RLS), so the
-- client never writes wallets / point_transactions directly (read-only under RLS
-- per 002).
--
-- Invariants / safety, matching the 003 convention:
--   * the kid's wallet row is locked FOR UPDATE before the balance read, so
--     concurrent awards serialize on that row.
--   * SELF-AUTHORIZES the CALLER in-body (atomic-fn-caller-authz): auth.uid()/
--     auth.jwt() still reflect the caller inside a definer function, so the
--     in-function check — not RLS, not a trusted server — is the authz boundary.
--   * search_path is pinned to keep SECURITY DEFINER safe.


-- ===========================================================================
-- award_bonus_points(kid_id, amount, note, awarded_by)   — task #21
--
-- A parent awards ad-hoc bonus points to a kid in their family:
--   1. lock the kid's wallet row FOR UPDATE (serialize concurrent awards).
--   2. AUTHORIZE: caller must be a PARENT in the kid's family. A kid may NEVER
--      award points — including to themselves.
--   3. validate amount > 0 (a bonus is always positive).
--   4. write a positive point_transactions row (type 'bonus', note, awarded_by).
--   5. increment the kid's wallets.wallet_balance by amount.
--
-- p_awarded_by is the awarding parent's profiles.id, recorded for provenance.
-- p_note may be null/blank — allowed.
--
-- Returns: the new point_transactions.id (the bonus row).
-- Raises:  wallet missing (no_data_found); caller not a parent in the family
--          (insufficient_privilege); amount null/<=0 (check_violation).
-- ===========================================================================
create or replace function award_bonus_points(
  p_kid_id    uuid,
  p_amount    integer,
  p_note      text,
  p_awarded_by uuid
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
  -- Lock the wallet first → serializes concurrent awards for this kid.
  select * into v_wallet
    from wallets
   where kid_id = p_kid_id
   for update;

  if not found then
    raise exception 'wallet for kid % not found', p_kid_id
      using errcode = 'no_data_found';
  end if;

  -- AUTHORIZATION: only a PARENT in the kid's family may award a bonus. A kid
  -- must never award points (including to themselves).
  if not (auth_role() = 'parent' and auth_family_id() = v_wallet.family_id) then
    raise exception 'only a parent in the family may award bonus points'
      using errcode = 'insufficient_privilege';
  end if;

  -- A bonus is always positive.
  if p_amount is null or p_amount <= 0 then
    raise exception 'bonus amount must be positive, got %', p_amount
      using errcode = 'check_violation';
  end if;

  insert into point_transactions (family_id, kid_id, type, amount, note, awarded_by)
    values (v_wallet.family_id, p_kid_id, 'bonus', p_amount, p_note, p_awarded_by)
    returning id into v_txn_id;

  update wallets
     set wallet_balance = wallet_balance + p_amount
   where kid_id = p_kid_id;

  return v_txn_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- Grant. SECURITY DEFINER + self-authorizing (parent-only, own family).
-- EXECUTE to `authenticated` only — NEVER `anon`.
-- ---------------------------------------------------------------------------
revoke all on function award_bonus_points(uuid, integer, text, uuid) from public;
grant execute on function award_bonus_points(uuid, integer, text, uuid) to authenticated;
