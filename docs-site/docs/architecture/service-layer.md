---
title: Service Layer
description: The packages/client + packages/domain boundary — the only code that talks to Supabase, plus the pure logic it leans on.
---

# Service Layer

Two packages sit between the apps and the backend. `packages/client` is the **service layer** — the only code that imports the Supabase client. `packages/domain` is **pure logic** — no I/O at all. This boundary is a [portability rule](./stack-decisions.md): screens and stores never call `supabase` directly, so a future backend swap touches one package instead of every screen.

## The pattern

Every service function takes a Supabase client as its first argument and returns either the awaited PostgREST result (`{ data, error }`) or the RPC promise. The caller controls how the client is created — web builds a `@supabase/ssr` client, mobile a plain client, kid sessions a client carrying the minted kid JWT. **RLS scopes every query** to the caller's family (see [Security & RLS](../backend/security-rls.md)), and privileged mutations go through RPC wrappers over [atomic SQL functions](../backend/atomic-functions.md) rather than direct writes.

`packages/client/src/index.ts` re-exports every module; both apps import from `@lootloop/*` (types) and the client barrel.

## Service modules (`packages/client/src`)

- `supabase.ts` — `createSupabaseClient` factory (typed against `Database`).
- `connection.ts` — `checkConnection`, an unauthenticated reachability probe hit on startup.
- `auth.ts` — parent email/password auth (`signUpParent`, `signInParent`, `signOut`, password reset/update), the family-bootstrap RPCs (`createFamilyAndParent`, `createFamilyInvite`, `joinFamilyAsParent`), and `mapAuthError`. Defines `LootLoopClient`.
- `pwned.ts` — self-hosted breached-password check via the k-anonymity HaveIBeenPwned range API (never sends the password or full hash).
- `kidSession.ts` — kid login: thin wrappers over the `family-roster` and `kid-auth` Edge Functions plus a factory that builds a client carrying the kid JWT (kids are not `auth.users`).
- `kids.ts` — parent-session kid management (RPC wrappers over the `SECURITY DEFINER` functions in migration 005).
- `chores.ts` — chore CRUD, the approval queue (`listPendingCompletions`), and the `award_points_on_approval` / reject paths.
- `kidChores.ts` — kid-session chore reads + own-completion claim/submit (called with a kid client).
- `rewards.ts` — reward catalog + fulfillment (parent) and browse/purchase (kid).
- `points.ts` — points + wallet read service (`wallets` and `point_transactions` are SELECT-only under RLS).
- `reading.ts` — reading logs + streak service (kid logs their own; parent approves).
- `savings.ts` — the `transfer_to_savings` RPC (deposit = wallet→savings, withdraw = savings→wallet; overdraft rejected) and the savings ledger reader.
- `schedule.ts` — daily-schedule CRUD (parent) and the kid timeline.
- `family.ts` — co-parent management (invite codes are minted via `createFamilyInvite` in `auth.ts`).
- `account.ts` — account/family deletion, wrapping the `delete-account` Edge Function.
- `realtime.ts` — a Postgres Changes subscription helper so screens react to live DB changes without refetching.

There is no separate `savings_goals` service module — savings-goal reads/writes are ordinary family-scoped table access alongside the savings flow (savings goals are one of the DB tables; see the [data model](../backend/data-model.md)).

## Pure logic (`packages/domain/src`)

I/O-free and heavily unit-tested. No Supabase, no `fetch`.

- `interest.ts` — `MONTHLY_RATE = 0.05` (5% teaching rate); `calculateInterest(balance)` returns the rounded monthly interest; `projectInterest(currentSavings, additionalAmount)` projects interest on a hypothetical balance.
- `points.ts` — `addPoints(balance, amount)` and `deductPoints(balance, amount)` (both reject negative amounts; `deductPoints` throws on insufficient balance).
- `recurrence.ts` — `occursOn(recurrenceRule, date)`: a deliberately minimal RRULE subset (`FREQ=DAILY`, `FREQ=WEEKLY;BYDAY=…`). Returns `false` for null/empty rules and anything outside the subset rather than guessing. The `generate-recurring-chores` Edge Function ports the same logic into Deno.
