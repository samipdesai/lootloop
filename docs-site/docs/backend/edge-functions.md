---
title: Edge Functions
description: The five Deno edge functions — kid login/roster, recurring-chore generation, monthly interest, and account deletion.
---

# Edge Functions

Five Deno edge functions sit alongside the database. Two are the pre-auth surface for kids (who are not `auth.users`); two are privileged maintenance jobs run by a scheduler; one is the parent-facing account/family deletion.

Source: `supabase/functions/`. Each returns fixed JSON shapes and **never leaks a stack trace** — every failure path returns a generic `{ "error": ... }`.

## kid-auth

A kid logs in with a PIN. Verifies the PIN against `profiles.pin_hash`, then mints the JWT the [RLS helpers](./security-rls.md) read.

- **Request:** `POST { family_id, profile_id, pin }` (all validated; ids must be UUIDs, PIN 1–72 chars).
- **Response `200`:** `{ access_token, token_type: "bearer", expires_in, profile: { id, family_id, display_name, avatar_url, age_mode } }`. The access token is an **HS256 JWT** with claims `{ role: "authenticated", ll_role: "kid", family_id, profile_id, sub: <profile_id>, aud: "authenticated", exp }` (TTL 30 days).
- **Auth model:** this function **is** the trust boundary. It reads `profiles` over a direct privileged Postgres connection (`SUPABASE_DB_URL`) — not PostgREST — because the app tables grant DML only to `authenticated`. It signs with the secret from `KID_AUTH_JWT_SECRET` (falls back to `SUPABASE_JWT_SECRET`, then the `oct` key inside `SUPABASE_JWKS` for local dev). The `SUPABASE_` prefix is reserved, so the deployed secret uses the un-prefixed `KID_AUTH_JWT_SECRET` (the project's legacy HS256 secret, which PostgREST still accepts on asymmetric-key projects).
- **Security:** PIN compared with `bcryptjs.compare`. Bad PIN and no-such-kid return a **byte-identical `401`** (`invalid_credentials`) — and a dummy bcrypt compare runs when the kid is absent — so callers can't enumerate kids. PIN and signing secret are never logged.

See [Kid Provisioning & Auth](../flows/kid-provisioning-auth.md).

## family-roster

The pre-auth step before `kid-auth`: a kid device with no session types the family's `kid_code` and gets the roster to pick a profile.

- **Request:** `POST { code }` (uppercased before lookup; 1–64 chars).
- **Response `200`:** `{ family_id, family_name, kids: [ { profile_id, display_name, avatar_url, age_mode } ] }`, ordered by `display_name`.
- **Auth model:** no session; like `kid-auth` it uses a direct privileged Postgres connection (`SUPABASE_DB_URL`), resolving the family by `families.kid_code`. The `kid_code` **is** the bearer secret — holding a valid code intentionally exposes kid first names + avatars (the accepted product model).
- **Security:** a per-IP fixed-window rate limit (20 req / 60s, keyed off `x-forwarded-for`) runs **before** any DB work; any unknown well-formed code returns a **generic `404`** (`not_found`). The rate limiter is per-instance/in-memory — a speed-bump; production sits behind a WAF/gateway limit.

## generate-recurring-chores

Materializes `chore_instances` for recurring chores on a given date — a privileged maintenance job, not a client endpoint.

- **Request:** `POST { date?: "YYYY-MM-DD", family_id?: <uuid> }` (both optional; `date` defaults to today, `family_id` scopes to one family else all).
- **Response `200`:** `{ generated, date }` — `generated` is the count of rows **actually inserted**.
- **Auth model:** requires the bearer to equal the **service-role key** (`SUPABASE_SERVICE_ROLE_KEY`); anything else is `401`. DB access is a direct privileged connection (`SUPABASE_DB_URL`).
- **Logic:** fetches `active`, recurring chores, filters in TS with a ported `occursOn` (RRULE subset: `FREQ=DAILY`; `FREQ=WEEKLY;BYDAY=...`; anything else does not generate), then bulk-inserts with `ON CONFLICT (chore_id, due_date) DO NOTHING` — **idempotent**, so a re-run for the same date inserts 0. Weekday is computed at UTC midnight.

See [Chores](../features/chores.md).

## calculate-interest

Monthly job crediting 5% interest on every kid's savings balance — a privileged maintenance job.

- **Request:** `POST { family_id?: <uuid>, kid_id?: <uuid> }` (both optional; `kid_id` wins over `family_id`, else all families).
- **Response `200`:** `{ credited, total, scope: "all"|"family"|"kid" }` — `credited` = kids who received ≥ 1 pt, `total` = points credited.
- **Auth model:** requires the **service-role key** bearer (else `401`); direct privileged Postgres connection (`SUPABASE_DB_URL`).
- **Logic:** fetches wallets with `savings_balance > 0`, computes `Math.round(balance * 0.05)` via a ported `calculateInterest`, skips amounts that round to 0, and for each eligible kid calls the [`credit_interest` RPC](./atomic-functions.md) (service-role-only; keeps the balance update + `interest` ledger row atomic under the wallet lock).

See [Savings & Interest flow](../flows/savings-interest.md).

## delete-account

Parent-facing account & family deletion (hard delete). Selected by `action`.

- **Request:** `POST { action: "leave" | "delete_family" }` with **the parent's GoTrue access token** as the `Authorization: Bearer` (required).
- **Response `200`:** `{ ok: true, action, deleted_users }` — count of `auth.users` rows removed.
- **Auth model:** the **caller's token is the authorization**. The function forwards it to PostgREST so the SECURITY DEFINER SQL functions self-authorize off the caller's JWT (`auth_role()='parent'`, own family); it does **not** use the service-role key for the DB call. `leave_family()` / `delete_family()` return the parent `auth_user_id`(s), which the function then removes via the GoTrue admin API (`auth.admin.deleteUser`) using the service-role client — the supported way to drop an auth user (SQL functions can't delete from `auth.users`).
- **Error mapping:** the SQL `check_violation` (last-parent guard) → `403 last_parent`; `insufficient_privilege` (not a parent) → `401`.

The underlying SQL is documented under [Atomic Functions](./atomic-functions.md).
