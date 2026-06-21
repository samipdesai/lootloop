// Savings service (tasks #31-#33), shared by web + mobile. Mirrors chores.ts:
// each fn takes the Supabase client first and returns the awaited PostgREST
// result ({ data, error }) or the rpc promise. RLS (002): savings_transactions
// is SELECT-only (kid own / parent family). The atomic move runs through the
// transfer_to_savings RPC (003) — deposit = wallet->savings, withdraw =
// savings->wallet; the SQL fn rejects overdraft, surfaced here as an error.
// Wallet balances (#31) come from the existing getKidWallet in points.ts.
import type { Database } from '@lootloop/types';
import type { LootLoopClient } from './auth';

export type SavingsTransaction = Database['public']['Tables']['savings_transactions']['Row'];

// The full enum includes 'interest', but that type is cron-only (credit_interest);
// only 'deposit' / 'withdraw' are valid caller-supplied directions.
export type SavingsDirection = Database['public']['Enums']['savings_txn_type'];

// Move points between the spendable wallet and savings, atomically. deposit
// moves wallet->savings; withdraw moves savings->wallet. Self-authorizing
// (parent OR the owning kid) in the SQL function. An overdraft returns an error.
export function transferToSavings(
  client: LootLoopClient,
  kidId: string,
  amount: number,
  direction: 'deposit' | 'withdraw',
) {
  return client.rpc('transfer_to_savings', {
    p_kid_id: kidId,
    p_amount: amount,
    p_direction: direction,
  });
}

// A kid's savings ledger (deposit/withdraw/interest), newest first. (#33.)
export function listSavingsTransactions(client: LootLoopClient, kidId: string) {
  return client
    .from('savings_transactions')
    .select('*')
    .eq('kid_id', kidId)
    .order('created_at', { ascending: false });
}
