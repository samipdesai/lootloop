---
title: Atomic Functions
description: The SECURITY DEFINER Postgres RPCs that are the only writers of money and state, each self-authorizing the caller.
---

# Atomic Functions

Every mutation that touches money, a balance, or state that must stay consistent runs through a `SECURITY DEFINER` Postgres function — never client-side DML. These functions are owned by `postgres` and **bypass RLS**, so the read-only tables (`wallets`, both ledgers, `reading_streaks`) can be written only here.

Source: `supabase/migrations/003_functions_and_triggers.sql`, `004_auth_bootstrap.sql`, `005_kid_management.sql`, `006_bonus_points.sql`, `007_reading_approval.sql`, `009_account_deletion.sql`, `011_consent_record.sql`.

## The self-authorization convention

Because a function bypasses RLS **and** is granted to `authenticated`, and because the client calls the RPC **directly** over PostgREST (there is no trusted server tier in between), each function **must authorize the caller in-body**. Inside a `SECURITY DEFINER` function `auth.uid()` / `auth.jwt()` still reflect the caller, so the [`auth_*()` helpers](./security-rls.md) resolve the real caller. That in-function check — not RLS, not a server — is the authorization boundary.

Every function also:

- pins its `search_path` (defeats `search_path` hijacking),
- takes `FOR UPDATE` row locks before reading a balance (serializes concurrent calls, prevents double-spend/double-award),
- is idempotent where re-invocation is possible,
- has `EXECUTE` revoked from `public`/`anon` and granted narrowly (re-asserted in `010_security_hardening.sql`).

## Money & state functions (migrations 003 / 006 / 007)

### `award_points_on_approval(p_completion_id uuid, p_reviewer_id uuid) → uuid`

Approves a `chore_completion`: sets `status='approved'` + `awarded_points` (the `chore_instances.points` snapshot), writes an `earn` ledger row, increments `wallet_balance`. Returns the `point_transactions.id`.

- **Caller:** a **parent in the completion's family** only (a kid may never approve, including their own). Granted to `authenticated`.
- **Atomicity:** locks the completion `FOR UPDATE`; **idempotent** — re-approving an already-`approved` row returns the existing earn row (no double-award). Raises if the completion is `rejected`.

See [Chore Approval flow](../flows/chore-approval.md).

### `purchase_reward(p_reward_id uuid, p_kid_id uuid) → uuid`

A kid buys a reward: locks the wallet, checks the reward is active and same-family, asserts `wallet_balance >= cost`, decrements the wallet, writes a `spend` ledger row (`-cost`), inserts a `reward_purchases` row (`status='purchased'`) linked to the ledger. Returns the `reward_purchases.id`.

- **Caller:** the **owning kid or a parent** in the kid's family. Granted to `authenticated`.
- **Atomicity:** wallet `FOR UPDATE` serializes purchases (no overdraft / double-spend). Raises on inactive reward, cross-family mismatch, or insufficient funds.

See [Reward Purchase flow](../flows/reward-purchase.md).

### `transfer_to_savings(p_kid_id uuid, p_amount integer, p_direction savings_txn_type) → uuid`

Moves points between wallet and savings. `deposit`: wallet → savings (needs `wallet_balance >= amount`); `withdraw`: savings → wallet (needs `savings_balance >= amount`). Writes one `savings_transactions` row (`+amount` deposit / `-amount` withdraw). Returns its id.

- **Caller:** the **owning kid or a parent** in the kid's family. Granted to `authenticated`.
- **Atomicity:** wallet `FOR UPDATE`; overdraft in either direction is rejected; `amount` must be `> 0`; `direction` must be `deposit`/`withdraw`.

See [Savings & Interest flow](../flows/savings-interest.md).

### `credit_interest(p_kid_id uuid, p_amount integer) → uuid`

Credits `amount` to savings and writes an `interest` ledger row under the wallet lock. Returns the `savings_transactions.id`.

- **Caller:** **`service_role` only.** It has **no in-body caller gate** (it can't encode "is the cron"), so it must never be reachable by clients — granted to `service_role`, revoked from `anon`/`authenticated`. Invoked by the [`calculate-interest` Edge Function](./edge-functions.md).
- **Atomicity:** wallet `FOR UPDATE`; `amount` must be `> 0`.

### `award_bonus_points(p_kid_id uuid, p_amount integer, p_note text, p_awarded_by uuid) → uuid`

A parent gives ad-hoc bonus points: writes a `bonus` ledger row (with `note` + `awarded_by` provenance) and increments `wallet_balance`. Returns the `point_transactions.id`.

- **Caller:** a **parent in the kid's family** only. Granted to `authenticated`.
- **Atomicity:** wallet `FOR UPDATE`; `amount` must be `> 0`.

### `approve_reading_log(p_reading_id uuid, p_reviewer_id uuid, p_points integer) → uuid`

Approves a `reading_log` **and advances the reading streak in one transaction**: sets `status='approved'` + `awarded_points`, writes an `earn` ledger row (linked via `reading_log_id`), increments `wallet_balance`, then updates `reading_streaks` off `read_on` (consecutive day extends `current_streak`; any gap resets to 1; same/backdated day leaves it unchanged; `longest_streak` tracks the max). Returns the `point_transactions.id`.

- **Caller:** a **parent in the log's family** only. Granted to `authenticated`.
- **Atomicity:** locks the reading_log and streak `FOR UPDATE`; **idempotent** — re-approving returns the existing earn row (no double-award, no double-bump). Raises if `rejected` or `points <= 0`. (Rejection has no function — a parent rejects via direct UPDATE under RLS.)

See [Reading Streak flow](../flows/reading-streak.md).

### `ensure_kid_wallet_and_streak()` — trigger

`AFTER INSERT` on `profiles`: when a kid profile is created, inserts its `wallets` and `reading_streaks` rows (`ON CONFLICT DO NOTHING`), so a kid's balances and streak are never missing.

## Bootstrap & family functions (migration 004 / 011)

### `create_family_and_parent(p_family_name text, p_display_name text) → uuid`

Called by a freshly-confirmed auth user during onboarding: creates a new `families` row (stamping the COPPA `consent_accepted_at` + `consent_policy_version`, per `011`) and inserts the caller's `parent` profile. Returns the `family_id`.

- **Caller:** a **profile-less confirmed auth user** — gated on `auth.uid() IS NOT NULL`, not a kid session, and no existing profile (blocks re-binding / a second family). Granted to `authenticated`.

### `create_family_invite() → text`

A parent mints a single-use, 8-char, 7-day co-parent invite code for **their own** family (`auth_family_id()`). Returns the code. Collision-retries on the unique constraint.

- **Caller:** a **parent** (`auth_role()='parent'`). Granted to `authenticated`.

### `join_family_as_parent(p_code text, p_display_name text) → uuid`

A profile-less confirmed auth user redeems an invite code to join an existing family as a co-parent: validates + locks the invite `FOR UPDATE`, inserts a `parent` profile, marks the invite `used_at`/`used_by`. Returns the `family_id`.

- **Caller:** a **profile-less confirmed auth user** (same gate as `create_family_and_parent`). Granted to `authenticated`.
- **Atomicity:** invite `FOR UPDATE` so concurrent redemptions can't both succeed.

See [Auth & Onboarding](../features/auth-onboarding.md).

## Kid-management functions (migration 005)

All five are parent-only, operate strictly within `auth_family_id()`, and are granted to `authenticated`.

| Function                                                                                     | Effect                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create_kid(p_display_name, p_pin, p_age_mode, [p_birthdate], [p_avatar_url]) → uuid`        | Inserts a kid profile with a bcrypt (cost 10) PIN hash via `crypt(pin, gen_salt('bf', 10))`. The `003` trigger auto-creates its wallet + streak. PIN must be 4–10 digits. |
| `update_kid(p_kid_id, [p_display_name], [p_age_mode], [p_avatar_url], [p_birthdate]) → void` | Updates only the provided (non-null) fields; never touches `role`/`family_id`/`pin_hash`.                                                                                 |
| `set_kid_pin(p_kid_id, p_pin) → void`                                                        | Re-hashes the kid's PIN (bcrypt cost 10). PIN must be 4–10 digits.                                                                                                        |
| `delete_kid(p_kid_id) → void`                                                                | Hard-deletes the kid profile; FKs cascade the wallet/ledgers/streak.                                                                                                      |
| `regenerate_family_code() → text`                                                            | Rotates `families.kid_code` to a fresh unique code and returns it.                                                                                                        |

Two internal helpers back the family code — `gen_unique_kid_code()` (collision-checked generator) and the `set_family_kid_code()` `BEFORE INSERT` trigger — and are not part of the client API. See [Kid Provisioning & Auth](../flows/kid-provisioning-auth.md).

## Account & family deletion (migration 009)

Both are parent-only, act only on the caller's own family, and are granted to `authenticated`. They return `auth_user_id`(s) for the [`delete-account` Edge Function](./edge-functions.md) to remove from GoTrue (these SQL functions can't delete from `auth.users`).

| Function                       | Effect                                                                                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `leave_family() → uuid`        | The calling parent deletes only their own profile; **raises** if they are the last parent (must `delete_family()` instead). Returns the caller's `auth_user_id`. |
| `delete_family() → setof uuid` | Deletes the `families` row; `ON DELETE CASCADE` wipes every family-scoped row. Returns each parent `auth_user_id` in the family.                                 |

## Grants summary

- **`authenticated` (client RPC):** `award_points_on_approval`, `purchase_reward`, `transfer_to_savings`, `award_bonus_points`, `approve_reading_log`, all kid-management RPCs, `create_family_and_parent`, `create_family_invite`, `join_family_as_parent`, `regenerate_family_code`, `leave_family`, `delete_family`. Each self-authorizes in-body.
- **`service_role` only:** `credit_interest` (no in-body gate — cron/edge seam).
- **`anon`:** never granted `EXECUTE` on any of these.

See [Security & RLS](./security-rls.md) for the read/write layer and [Data Model](./data-model.md) for the tables these functions mutate.
