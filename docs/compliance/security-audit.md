# Security Audit — LootLoop (M7 #51)

**Date:** 2026-06-24 · **Target:** prod Supabase `lootloop-prod` (`tuobznejndvoeicdtasd`) + repo
**Method:** Supabase security + performance advisors, direct privilege inspection
(`has_function_privilege`), RLS coverage check, edge-function review, committed-secret
scan, local re-verification of the fix via the full SQL integration suite.

## Summary

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| M-1 | **Medium** | Prod function EXECUTE grants drifted wide open (anon + authenticated can call every SECURITY DEFINER fn, incl. `service_role`-only `credit_interest`) | ✅ **FIXED on prod** (migration `010` applied + advisor-verified 2026-06-24) |
| L-1 | Low | `set_updated_at` has a role-mutable `search_path` | ✅ Fixed in `010` (applied to prod) |
| L-2 | Low | Auth: leaked-password protection (HaveIBeenPwned) disabled | **Requires Pro plan** — Free tier returns HTTP 402; bundle with the Pro upgrade (see #49) |
| — | Info | Performance: unindexed FKs, unused indexes, multiple-permissive-policies | Deferred (low priority; see below) |

No critical issues. RLS is enabled and enforced on all tables; no secrets are committed.

---

## M-1 (Medium) — Production function grant drift

**Finding.** Every `SECURITY DEFINER` function in prod is executable by both `anon` and
`authenticated`. The intended design (set in migrations 003/005/… and asserted by the
integration tests) locks these down. Most impactful case: **`credit_interest(uuid,int)`**
— the monthly-interest cron seam with **no in-body caller gate** — is meant to be
`service_role`-only, but in prod a signed-in user could call it via
`/rest/v1/rpc/credit_interest` to mint interest points. The parent/kid management RPCs
are also callable by `anon` (they self-authorize in-body, so this is defense-in-depth,
not direct data exposure — but it's not the intended posture).

**Why prod differs from local.** Local + CI enforce the correct grants (the tests assert,
e.g., `authenticated` *cannot* call `credit_interest`). The remote project came up with
EXECUTE granted broadly during provisioning; migration 003's `REVOKE`s did not survive on
the remote. Verified by `has_function_privilege` on both:

```
                 local (correct)   prod (drifted)
credit_interest  anon=f auth=f      anon=t auth=t   ← any signed-in user could mint points
create_kid       anon=f auth=t      anon=t auth=t
purchase_reward  anon=f auth=t      anon=t auth=t
```

**Fix — `supabase/migrations/010_security_hardening.sql`** (re-asserts grants per-function,
so the result is correct regardless of the remote's current state):
- Client RPCs → `authenticated` only (revoke `anon`/`public`).
- `credit_interest` → `service_role` only.
- Trigger/internal fns (`ensure_kid_wallet_and_streak`, `set_family_kid_code`,
  `gen_unique_kid_code`) → revoked from `anon`/`authenticated` (triggers fire as definer).
- `auth_*` RLS helpers left executable (RLS calls them every query; they return null for
  anon). `family-roster`/`kid-auth` use a direct DB connection, not these RPCs, so the
  lockdown does not affect kid login.

**Verified:** applied to a fresh local DB (`db reset` → all 10 migrations) and the full SQL
integration suite passes **8/8** (incl. the grant-assertion + cross-family RLS isolation
tests). **Not yet applied to prod** — requires your approval (`supabase db push`).

## L-1 (Low) — `set_updated_at` mutable search_path

A SECURITY-relevant hygiene gap (search_path injection vector on functions). Fixed in
`010` (`alter function set_updated_at() set search_path = public, pg_temp`). All other
functions already pin search_path.

## L-2 (Low) — Leaked-password protection disabled

Supabase Auth can reject passwords found in the HaveIBeenPwned breach corpus; it's
currently off. **This is a Pro-plan feature** — attempting to enable it on the current
Free tier returns `HTTP 402 Payment Required`. Enable it as part of upgrading the project
to Pro (which also stops the 7-day idle pause and adds daily backups — see #49). Once on
Pro: Management API `PATCH /v1/projects/<ref>/config/auth {"password_hibp_enabled": true}`,
or dashboard → Auth. Zero app impact.

## Accepted / by-design (no action)

- **`authenticated` can execute the atomic RPCs** (`purchase_reward`, `award_points_on_approval`,
  `leave_family`, etc.) — *intended*: the app calls them as the signed-in user, and each
  self-authorizes the caller in-body (parent/owning-kid + family checks). The advisor's
  "authenticated executable" warnings on these are expected.
- **`auth_*` helpers executable by anon** — RLS helper functions; safe (return null without a session).

## Performance (informational — deferred)

All `INFO`/`WARN`, none security-related, low priority for launch traffic:
- **Unindexed FKs** (reviewer/awarded_by/etc. columns) — add covering indexes if these
  become hot; negligible at current scale.
- **Unused indexes** — expected on a zero-traffic DB; do not drop yet.
- **Multiple permissive policies** (kid + parent UPDATE on `profiles`/`chore_completions`/
  `reading_logs`/`savings_goals`) — could be merged into one policy per action for a minor
  speedup; functional + correct as-is.

## Verified secure ✓

- **RLS enabled on all 15 tables**; cross-family isolation proven by the integration suite.
- **No committed secrets** — scan found only comments/test-code/runtime-reads; `.env*`,
  `.secrets/`, `.p8`, and signing material are gitignored.
- **Edge-function JWT gates correct** — `kid-auth` is `verify_jwt=false` by design (it *is*
  the PIN gate); all others (incl. `delete-account`) require a JWT.
- **Kid PINs** stored as bcrypt hashes (cost 10); never plaintext.
- **Service-role key** not bundled into any client; edge functions get it auto-injected.

## Actions required from you

1. ✅ ~~Apply `010` to prod~~ — DONE (applied + advisor-verified 2026-06-24).
2. **Merge PR #33** — 010 is live on prod, but the PR is unmerged; merge so `main`/local/CI
   migration history includes it.
3. **Enable leaked-password protection** — requires upgrading to **Pro** (Free returns 402).
   Bundle with the Pro upgrade (also stops 7-day idle pause + adds daily backups, per #49).
4. (Optional) Investigate why the remote dropped 003's grants, in case future migrations
   need the same explicit re-assertion.
