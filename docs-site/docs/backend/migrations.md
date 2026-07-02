---
title: Migrations
description: The ordered supabase/migrations SQL files that build LootLoop's schema, RLS, and functions, plus the SQL test suite.
---

# Migrations

The database is built by ordered SQL files in `supabase/migrations/`, applied in numeric order. Together they define the schema, RLS policies, atomic functions, and later hardening.

| File                             | What it adds                                                                                                                                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `001_initial_schema.sql`         | All base tables (families, profiles, chores, chore_instances, chore_completions, wallets, point_transactions, rewards, reward_purchases, reading_logs, reading_streaks, savings_transactions, savings_goals, schedule_items) + enums + indexes + the shared `set_updated_at()` trigger. |
| `002_rls_policies.sql`           | Enables RLS on every family-scoped table, the `auth_*()` principal-resolution helpers, coarse table GRANTs, and per-table read/write policies.                                                                                                                                          |
| `003_functions_and_triggers.sql` | Core atomic functions (`award_points_on_approval`, `purchase_reward`, `transfer_to_savings`, `credit_interest`) + the `ensure_kid_wallet_and_streak` trigger.                                                                                                                           |
| `004_auth_bootstrap.sql`         | The `family_invites` table + onboarding functions `create_family_and_parent`, `create_family_invite`, `join_family_as_parent`.                                                                                                                                                          |
| `005_kid_management.sql`         | `families.kid_code` (+ generator/trigger) and the parent-only kid-management RPCs (`create_kid`, `update_kid`, `set_kid_pin`, `delete_kid`, `regenerate_family_code`).                                                                                                                  |
| `006_bonus_points.sql`           | `award_bonus_points` — a parent's ad-hoc bonus award.                                                                                                                                                                                                                                   |
| `007_reading_approval.sql`       | `point_transactions.reading_log_id` + `approve_reading_log` (awards points and advances the reading streak atomically).                                                                                                                                                                 |
| `008_realtime.sql`               | Adds the live-sync tables to the `supabase_realtime` publication (idempotent).                                                                                                                                                                                                          |
| `009_account_deletion.sql`       | `leave_family` and `delete_family` (return `auth_user_id`s for the delete-account edge function).                                                                                                                                                                                       |
| `010_security_hardening.sql`     | Pins `set_updated_at`'s `search_path` and re-asserts EXECUTE grants (client RPCs → `authenticated`; `credit_interest` → `service_role` only) after remote grant drift.                                                                                                                  |
| `011_consent_record.sql`         | `families.consent_accepted_at` / `consent_policy_version` (COPPA) and recreates `create_family_and_parent` to stamp the consent record.                                                                                                                                                 |

The [Data Model](./data-model.md) and [Atomic Functions](./atomic-functions.md) pages document what these files produce.

## SQL tests

`supabase/tests/` holds pgTAP-style SQL tests run against the local Supabase Docker stack (via `run-all.sh`). They prove cross-family RLS isolation and atomic-function correctness/idempotency:

- `rls_and_functions_test.sql`, `rls_isolation_remaining_tables_test.sql` — RLS read/write isolation across families for parents and kids.
- `atomic_fns_idempotency_test.sql` — no double-award / double-spend on the money functions.
- `auth_bootstrap_test.sql`, `kid_management_test.sql`, `bonus_points_test.sql`, `reading_approval_test.sql`, `account_deletion_test.sql` — per-feature function behavior and authorization guards.

There is no `seed.sql` in `supabase/`; tests set up their own fixtures and roll back.

See [Security & RLS](./security-rls.md) for the isolation model these tests verify.
