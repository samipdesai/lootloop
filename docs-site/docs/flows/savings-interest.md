---
title: Savings & Interest Flow
description: End-to-end trace of wallet-to-savings transfers and the monthly interest cron that credits compound interest.
---

# Savings & Interest Flow

This flow has two parts. First, on demand: a kid (or parent) moves points between the spendable wallet and savings via `transfer_to_savings`, which enforces direction, positive amount, and no overdraft in either direction. Second, monthly: the `calculate-interest` edge function iterates every wallet with a positive savings balance and calls the `credit_interest` atomic function (service-role only) to accrue a 5% teaching rate.

The transfer path routes through `packages/client/src/savings.ts`. `savings_transactions` is read-only under RLS; the atomic functions are the only writers.

```mermaid
sequenceDiagram
    participant Kid as Kid / Parent device
    participant SVC as packages/client
    participant TR as transfer_to_savings
    participant Cron as pg_cron
    participant EF as calculate-interest (edge fn)
    participant CI as credit_interest
    participant DB as Postgres

    Kid->>SVC: transferToSavings(client, kidId, amount, 'deposit'|'withdraw')
    SVC->>TR: rpc('transfer_to_savings', {p_kid_id, p_amount, p_direction})
    Note over TR: SECURITY DEFINER
    TR->>TR: validate direction + amount > 0
    TR->>DB: SELECT wallet FOR UPDATE (lock)
    TR->>TR: authorize caller = owning kid OR parent, same family
    TR->>DB: move points (deposit: wallet->savings; withdraw: reverse); no overdraft
    TR->>DB: INSERT savings_transactions (deposit +amt / withdraw -amt)
    TR-->>Kid: savings txn id

    Cron->>EF: POST (service-role bearer)
    EF->>DB: SELECT wallets WHERE savings_balance > 0
    loop each wallet
        EF->>EF: amount = round(savings_balance * 0.05)
        alt amount >= 1
            EF->>CI: rpc('credit_interest', {p_kid_id, p_amount})
            Note over CI: SECURITY DEFINER, service_role only
            CI->>DB: SELECT wallet FOR UPDATE
            CI->>DB: UPDATE savings_balance += amount
            CI->>DB: INSERT savings_transactions (type 'interest')
        else amount rounds to 0
            EF->>EF: skip
        end
    end
```

## Transfer steps

1. **Kid or parent moves points.** `transferToSavings(client, kidId, amount, direction)` (`packages/client/src/savings.ts`) calls `rpc('transfer_to_savings', {p_kid_id, p_amount, p_direction})`. Inside the `SECURITY DEFINER` function (`supabase/migrations/003_functions_and_triggers.sql`):
   - `direction` must be `'deposit'` or `'withdraw'`; `amount` must be `> 0`.
   - The kid's `wallets` row is locked `FOR UPDATE`.
   - The caller is authorized in-body: in the kid's family _and_ either that kid (`auth_profile_id() = p_kid_id`) or a parent.
   - **Deposit** moves `wallet -> savings` (requires `wallet_balance >= amount`) and inserts a `savings_transactions` row with `type='deposit'`, `amount = +amount`.
   - **Withdraw** moves `savings -> wallet` (requires `savings_balance >= amount`) and inserts a row with `type='withdraw'`, `amount = -amount`.
   - Overdraft in either direction raises an error. Returns the new `savings_transactions.id`.

2. **Ledger + goals.** `listSavingsTransactions(client, kidId)` reads the kid's savings ledger (deposit/withdraw/interest), newest first. `savings_goals` is a plain table read alongside for the savings UI (no atomic function involved).

## Monthly interest steps

1. **Cron invokes the edge function.** A scheduler (pg_cron) POSTs to the `calculate-interest` edge function with the project service-role key. The function requires the bearer to equal `SUPABASE_SERVICE_ROLE_KEY` (kid/parent/anon tokens are rejected 401) and opens a direct privileged Postgres connection. See `supabase/functions/calculate-interest/index.ts`.

2. **Iterate eligible wallets.** It selects wallets with `savings_balance > 0` (optionally scoped to one `family_id` or `kid_id`), and for each computes `amount = Math.round(savings_balance * 0.05)` — the ported `calculateInterest` (5% `MONTHLY_RATE`, mirrored from `packages/domain/src/interest.ts`). Wallets whose interest rounds to `< 1` point are skipped.

3. **Credit atomically.** For each eligible kid it calls `rpc('credit_interest', {p_kid_id, p_amount})`. This `SECURITY DEFINER` function is granted to `service_role` only (never `authenticated`) — it has no in-body caller gate, so a kid/parent client calling it fails at permission time. It locks the wallet `FOR UPDATE`, adds `amount` to `savings_balance`, and inserts a `savings_transactions` row with `type='interest'`, all in one transaction.

4. **Response.** The function returns `{ credited, total, scope }`. Because sub-1-point balances are skipped, a re-run after balances change credits only the newly eligible delta.

## See also

- [Savings & interest feature](../features/savings-interest.md)
- [Edge functions](../backend/edge-functions.md)
- [Atomic functions](../backend/atomic-functions.md)
