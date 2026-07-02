---
title: Savings & Interest
description: Kids move points between wallet and savings, set savings goals, and earn 5% monthly interest credited by a scheduled job.
---

# Savings & Interest

## What it does

Savings teaches delayed gratification. A kid moves points between their spendable `wallet_balance` and `savings_balance`, and can set goals to save toward. Savings earn **5% monthly interest**, credited automatically by a scheduled job. Transfers can never overdraw either balance.

## Data

Tables (`supabase/migrations/001_initial_schema.sql`, see [data model](../backend/data-model.md)):

- **`savings_transactions`** — append-only ledger. `amount` (non-zero), `type` is the `savings_txn_type` enum (`deposit` | `withdraw` | `interest`).
- **`savings_goals`** — a plain family-scoped table: `title`, `emoji`, `target` (points needed), `achieved_at`, `active`. There is **no dedicated client service module** for goals — they are ordinary table CRUD through the family-scoped client.
- **`wallets.savings_balance`** — the current savings balance (read-only to clients; mutated only by the functions below).

## Backend operations

Both are atomic SECURITY DEFINER functions (see [atomic functions](../backend/atomic-functions.md)):

- **`transfer_to_savings(...)`** — handles both deposit and withdraw, moving points between `wallet_balance` and `savings_balance` with a `savings_transactions` entry. Rejects overdrafts on either side.
- **`credit_interest(...)`** — service_role only, invoked from the scheduled cron; applies interest and writes an `interest` transaction. Not callable by clients.

## Service layer

`packages/client/src/savings.ts`:

- `transferToSavings(...)` — wraps `transfer_to_savings`
- `listSavingsTransactions(client, kidId)`

Savings goals use ordinary table access via the shared client (no `savings.ts` function).

Pure interest math lives in `packages/domain/src/interest.ts`: `MONTHLY_RATE = 0.05`, `calculateInterest(balance)` (rounds `balance * MONTHLY_RATE`), and `projectInterest(currentSavings, additionalAmount)`. I/O-free and reused by the cron job's logic and tests.

## Backend job

The `calculate-interest` edge function drives the monthly interest run, calling `credit_interest` per kid. See [edge functions](../backend/edge-functions.md).

## UI

Savings and goals are kid-facing only: `apps/mobile/src/screens/kid-savings/` (mobile only).

## See also

- [Savings interest flow](../flows/savings-interest.md)
