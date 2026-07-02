---
title: Rewards
description: Parents curate a reward catalog; kids buy items with points via an atomic debit; parents mark purchases as given.
---

# Rewards

## What it does

Rewards are how kids spend the points they earn. A parent authors a catalog of rewards (title, icon, point `cost`, `active` flag). A kid buys a reward, which atomically debits their wallet and records a purchase. The purchase starts as `purchased` and the parent later marks it `given` once the real-world reward is fulfilled.

## Data

Two tables (`supabase/migrations/001_initial_schema.sql`, see [data model](../backend/data-model.md)):

- **`rewards`** — catalog. `title`, `icon`, `cost` (points), `active`.
- **`reward_purchases`** — one row per purchase. `status` is the `purchase_status` enum (`purchased` | `given`), plus the `cost` snapshot and fulfillment metadata (`given_by`, `given_at`).

## Backend operations

- **Purchase** → `purchase_reward(...)` — an atomic SECURITY DEFINER function that checks the kid's balance, debits the wallet, writes a `spend` ledger entry, and inserts the `reward_purchases` row in one transaction (no overspend possible). See [atomic functions](../backend/atomic-functions.md).
- **Fulfill** → a plain `UPDATE` moving the purchase to `given`; no points move.

## Service layer

`packages/client/src/rewards.ts`:

- `listRewards`, `listActiveRewards`
- `createReward`, `updateReward`, `deleteReward`
- `purchaseReward(client, rewardId, kidId)` — wraps the atomic RPC
- `listPurchases` — fulfillment queue for the parent
- `markPurchaseGiven(client, purchaseId, givenBy)`

## UI

- **Parent (web + mobile):** `apps/web/app/(dashboard)/rewards/`; `apps/mobile/src/screens/rewards/`. The fulfillment tab is labeled "To give".
- **Kid (mobile only):** `apps/mobile/src/screens/kid-store/`.

## See also

- [Reward purchase flow](../flows/reward-purchase.md)
