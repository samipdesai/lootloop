---
title: Points & Wallet
description: The points economy — read-only wallet balances backed by an append-only transaction ledger, mutated only by atomic SQL functions.
---

# Points & Wallet

## What it does

Points are LootLoop's currency. Each kid has a **wallet** with a spendable `wallet_balance` and a separate `savings_balance`. Kids earn points by getting chore completions and reading logs approved, receive occasional parent bonuses, and spend points on rewards. Every balance change is recorded as an immutable ledger entry, so the wallet is always reconstructable from history.

## Data

Two tables (`supabase/migrations/001_initial_schema.sql`, see [data model](../backend/data-model.md)):

- **`wallets`** — current balances per kid (`wallet_balance`, `savings_balance`). **Read-only to clients** — mutated only by atomic SQL functions, never by direct client writes.
- **`point_transactions`** — append-only ledger. `amount` (non-zero), `type` is the `point_txn_type` enum (`earn` | `bonus` | `spend` | `refund`). This is the source of truth for the wallet balance.

## Backend operations

Balances only ever change through atomic SECURITY DEFINER functions that write a ledger row and update the wallet in the same transaction (see [atomic functions](../backend/atomic-functions.md)):

- **Earn** — `award_points_on_approval` (chore approval) and `approve_reading_log` (reading approval).
- **Bonus** — `award_bonus_points` (parent-initiated).
- **Spend** — `purchase_reward` (reward purchase).

## Service layer

`packages/client/src/points.ts`:

- `awardBonusPoints(...)` — wraps `award_bonus_points`
- `getKidWallet(client, kidId)` — reads the wallet row
- `listPointTransactions(client, kidId)` — reads the ledger

Pure balance arithmetic lives in `packages/domain/src/points.ts` (`addPoints`, `deductPoints`) — I/O-free helpers reused by the SQL-backed flows and tests.

## UI

Wallet balances and transaction history surface across the parent kid-detail views (`apps/web/app/(dashboard)/kids/`, `apps/mobile/src/screens/kid-detail/`) and the kid dashboard (`apps/mobile/src/screens/kid-dashboard/`, mobile only).

## See also

- [Chore approval flow](../flows/chore-approval.md)
