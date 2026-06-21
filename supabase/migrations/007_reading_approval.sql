-- LootLoop atomic reading approval + streak update (tasks #28 / #29).
--
-- A parent approves a kid's reading_log: award points AND advance the kid's
-- reading streak in ONE transaction. Like the other money/state mutations (003,
-- 006), the balance + ledger + streak writes happen HERE as SECURITY DEFINER
-- (owner = postgres, bypasses RLS), so the client never writes wallets /
-- point_transactions / reading_streaks directly (read-only under RLS per 002).
--
-- Invariants / safety, matching the 003/006 convention:
--   * the reading_log row is locked FOR UPDATE before any read/write, so
--     concurrent approvals of the same log serialize on that row.
--   * idempotent: re-approving an already-approved log returns the existing
--     'earn' ledger row id — never a second award, never a second streak bump.
--   * SELF-AUTHORIZES the CALLER in-body (atomic-fn-caller-authz): auth.uid()/
--     auth.jwt() still reflect the caller inside a definer function, so the
--     in-function check — not RLS, not a trusted server — is the authz boundary.
--   * search_path is pinned to keep SECURITY DEFINER safe.
--
-- Rejection has NO function: a parent rejects a reading_log via a direct UPDATE
-- under the existing reading_logs_parent_update RLS policy (002).


-- ---------------------------------------------------------------------------
-- Provenance link: the 'earn' ledger row written on reading approval points
-- back at its reading_log (mirrors point_transactions.chore_completion_id for
-- chore approvals in 001/003). This is also the key the function uses to look
-- up the existing earn row on idempotent re-approval. on delete set null keeps
-- the ledger append-only if a reading_log is later removed.
-- ---------------------------------------------------------------------------
alter table point_transactions
  add column reading_log_id uuid references reading_logs (id) on delete set null;


-- ===========================================================================
-- approve_reading_log(reading_id, reviewer_id, points)   — tasks #28 + #29
--
-- Approving a reading_log:
--   1. lock the reading_log row; no_data_found if missing.
--   2. AUTHORIZE: only a PARENT in the log's family may approve. A kid must not
--      approve anything, including their own reading.
--   3. idempotent: if already 'approved' -> return the existing 'earn' ledger
--      row id (no double-award, no double-streak). If 'rejected' -> reject.
--   4. validate p_points > 0 (point_transactions.amount must be <> 0).
--   5. set status='approved', awarded_points, reviewed_by, reviewed_at.
--   6. write a positive point_transactions row (type 'earn') + increment the
--      kid's wallets.wallet_balance.
--   7. advance the kid's reading_streaks row off read_on (see streak rule below).
--
-- Streak rule (#29), evaluated against the streak's last_read_date:
--   * last_read_date is null OR read_on > last_read_date (new, later day):
--       current_streak := (last_read_date = read_on - 1) ? current_streak + 1 : 1
--       -- a consecutive day extends the streak; any gap resets it to 1.
--       last_read_date := read_on
--       longest_streak := greatest(longest_streak, current_streak)
--   * read_on = last_read_date: no change (that day already counted).
--   * read_on < last_read_date (backdated): leave the streak unchanged.
--
-- Note: a "missed day" reset between approvals is realized at the NEXT approval
-- via the gap -> 1 branch (we only move forward on approvals). A display can
-- also derive staleness directly from last_read_date vs today.
--
-- Returns: the point_transactions.id of the earn row (existing one on re-approve).
-- Raises:  reading_log not found (no_data_found); caller not a parent in the
--          family (insufficient_privilege); log already 'rejected' or
--          p_points <= 0 (check_violation).
-- ===========================================================================
create or replace function approve_reading_log(
  p_reading_id  uuid,
  p_reviewer_id uuid,
  p_points      integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log    reading_logs%rowtype;
  v_streak reading_streaks%rowtype;
  v_txn_id uuid;
  v_new_streak integer;
begin
  -- Lock the reading_log to serialize concurrent approvals of the same row.
  select * into v_log
    from reading_logs
   where id = p_reading_id
   for update;

  if not found then
    raise exception 'reading_log % not found', p_reading_id
      using errcode = 'no_data_found';
  end if;

  -- AUTHORIZATION: only a PARENT in the log's family may approve. A kid must
  -- never approve a reading, including their own.
  if not (auth_role() = 'parent' and auth_family_id() = v_log.family_id) then
    raise exception 'only a parent in the family may approve readings'
      using errcode = 'insufficient_privilege';
  end if;

  -- Idempotent: approving an already-approved log must not double-award or
  -- double-bump the streak.
  if v_log.status = 'approved' then
    select id into v_txn_id
      from point_transactions
     where reading_log_id = p_reading_id
       and type = 'earn'
     order by created_at
     limit 1;
    return v_txn_id;
  end if;

  if v_log.status = 'rejected' then
    raise exception 'reading_log % is rejected; cannot approve', p_reading_id
      using errcode = 'check_violation';
  end if;

  -- An award is always positive (point_transactions.amount must be <> 0).
  if p_points is null or p_points <= 0 then
    raise exception 'awarded points must be positive, got %', p_points
      using errcode = 'check_violation';
  end if;

  update reading_logs
     set status         = 'approved',
         awarded_points = p_points,
         reviewed_by    = p_reviewer_id,
         reviewed_at    = now()
   where id = p_reading_id;

  insert into point_transactions (family_id, kid_id, type, amount, note, reading_log_id, awarded_by)
    values (v_log.family_id, v_log.kid_id, 'earn', p_points,
            'Reading approved', p_reading_id, p_reviewer_id)
    returning id into v_txn_id;

  update wallets
     set wallet_balance = wallet_balance + p_points
   where kid_id = v_log.kid_id;

  -- ---- Streak update (#29) ------------------------------------------------
  -- Lock the kid's streak row (bootstrapped by the 003 trigger) before reading.
  select * into v_streak
    from reading_streaks
   where kid_id = v_log.kid_id
   for update;

  if found then
    if v_streak.last_read_date is null or v_log.read_on > v_streak.last_read_date then
      -- New, later reading day: a consecutive day extends, a gap resets to 1.
      if v_streak.last_read_date = v_log.read_on - 1 then
        v_new_streak := v_streak.current_streak + 1;
      else
        v_new_streak := 1;
      end if;

      update reading_streaks
         set current_streak = v_new_streak,
             longest_streak = greatest(longest_streak, v_new_streak),
             last_read_date = v_log.read_on
       where kid_id = v_log.kid_id;
    end if;
    -- read_on = last_read_date (already counted) or read_on < last_read_date
    -- (backdated): leave the streak unchanged.
  end if;

  return v_txn_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- Grant. SECURITY DEFINER + self-authorizing (parent-only, own family).
-- EXECUTE to `authenticated` only — NEVER `anon`.
-- ---------------------------------------------------------------------------
revoke all on function approve_reading_log(uuid, uuid, integer) from public;
grant execute on function approve_reading_log(uuid, uuid, integer) to authenticated;
