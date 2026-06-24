-- 010: Security hardening (M7 #51).
--
-- Two fixes from the prod security audit:
--
-- (1) set_updated_at had a role-mutable search_path (linter 0011). Pin it.
--
-- (2) GRANT DRIFT: the prod project came up with EXECUTE granted to anon +
-- authenticated on EVERY SECURITY DEFINER function — including credit_interest,
-- which is meant to be service_role-only (it has no in-body caller gate, so a
-- signed-in user could mint interest points), and the parent/kid RPCs, which
-- should never be callable by anon. Local + the integration tests already
-- enforce the intended grants (003/005/etc.), but the remote drifted. Re-assert
-- them EXPLICITLY (per-function revoke-from-anon/public + grant-to-intended-role)
-- so the result is correct regardless of the remote's current grant source.
--
-- The auth_* RLS helper functions (auth_role/auth_family_id/auth_profile_id/
-- auth_is_kid) are intentionally left executable — RLS policies call them for
-- every authenticated query. The family-roster/kid-auth edge functions use a
-- direct DB connection (not these RPCs), so locking the RPCs down does not
-- affect kid login.

-- (1) search_path -------------------------------------------------------------
alter function public.set_updated_at() set search_path = public, pg_temp;

-- (2) re-assert EXECUTE grants ------------------------------------------------

-- Client RPCs: authenticated only (each self-authorizes the caller in-body).
do $$
declare fn text;
begin
  foreach fn in array array[
    'award_points_on_approval(uuid, uuid)',
    'purchase_reward(uuid, uuid)',
    'transfer_to_savings(uuid, integer, public.savings_txn_type)',
    'award_bonus_points(uuid, integer, text, uuid)',
    'approve_reading_log(uuid, uuid, integer)',
    'create_kid(text, text, public.age_mode, date, text)',
    'delete_kid(uuid)',
    'update_kid(uuid, text, public.age_mode, text, date)',
    'set_kid_pin(uuid, text)',
    'create_family_and_parent(text, text)',
    'join_family_as_parent(text, text)',
    'create_family_invite()',
    'regenerate_family_code()',
    'delete_family()',
    'leave_family()'
  ]
  loop
    execute format('revoke execute on function public.%s from anon, public', fn);
    execute format('grant execute on function public.%s to authenticated', fn);
  end loop;
end $$;

-- credit_interest: monthly-interest cron seam — service_role ONLY (no in-body
-- caller gate, so it must never be reachable by anon/authenticated clients).
revoke execute on function public.credit_interest(uuid, integer) from anon, authenticated, public;
grant  execute on function public.credit_interest(uuid, integer) to service_role;

-- Internal / trigger functions: not part of the public API. Triggers fire as
-- the definer regardless of these grants, so revoking EXECUTE is safe.
revoke execute on function public.ensure_kid_wallet_and_streak() from anon, authenticated, public;
revoke execute on function public.set_family_kid_code()          from anon, authenticated, public;
revoke execute on function public.gen_unique_kid_code()          from anon, authenticated, public;
