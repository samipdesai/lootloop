// Points + wallet read service (tasks #19-#21), shared by web + mobile parent
// surfaces. Mirrors chores.ts: each fn takes the Supabase client first and
// returns the awaited PostgREST result ({ data, error }) or the rpc promise.
// RLS (002) makes wallets + point_transactions SELECT-only (parent reads family,
// kid reads own); the ad-hoc bonus path (006) runs through the award_bonus_points
// RPC (parent-only, self-authorized).
import type { Database } from '@lootloop/types';
import type { LootLoopClient } from './auth';

export type Wallet = Database['public']['Tables']['wallets']['Row'];
export type PointTransaction = Database['public']['Tables']['point_transactions']['Row'];

// Award ad-hoc bonus points + note → writes a 'bonus' ledger row and increments
// the wallet atomically (task #21). Parent-only, self-authorizing in the SQL
// function. The generated Args type declares p_note as non-nullable `string`,
// but the SQL function accepts SQL NULL (no note); we widen locally so TS accepts
// null without changing runtime behavior.
export function awardBonusPoints(
  client: LootLoopClient,
  kidId: string,
  amount: number,
  note: string | null,
  awardedBy: string,
) {
  return client.rpc('award_bonus_points', {
    p_kid_id: kidId,
    p_amount: amount,
    p_note: note,
    p_awarded_by: awardedBy,
  } as Database['public']['Functions']['award_bonus_points']['Args']);
}

// A kid's wallet (spendable + savings balances). maybeSingle: the wallet exists
// once the kid is created (003 after-insert trigger), but stay null-safe. (#19.)
export function getKidWallet(client: LootLoopClient, kidId: string) {
  return client
    .from('wallets')
    .select('wallet_balance, savings_balance')
    .eq('kid_id', kidId)
    .maybeSingle();
}

// A kid's points ledger (earn/bonus/spend/refund), newest first. (#20.)
export function listPointTransactions(client: LootLoopClient, kidId: string) {
  return client
    .from('point_transactions')
    .select('*')
    .eq('kid_id', kidId)
    .order('created_at', { ascending: false });
}
