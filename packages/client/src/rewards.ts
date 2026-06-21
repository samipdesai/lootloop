// Reward catalog + fulfillment service (tasks #22-#25), shared by web + mobile
// parent surfaces (and the kid browse/purchase path). Mirrors chores.ts: each fn
// takes the Supabase client first and returns the awaited PostgREST result
// ({ data, error }) or the rpc promise. RLS (002) scopes every query to the
// caller's family; the atomic purchase path (003) runs through the
// purchase_reward RPC (parent OR the owning kid, self-authorized).
import type { Database } from '@lootloop/types';
import type { LootLoopClient } from './auth';

export type Reward = Database['public']['Tables']['rewards']['Row'];
export type RewardInsert = Database['public']['Tables']['rewards']['Insert'];
export type RewardUpdate = Database['public']['Tables']['rewards']['Update'];
export type RewardPurchase = Database['public']['Tables']['reward_purchases']['Row'];

// Shape returned by listPurchases for the fulfillment queue. Flattened so UI
// agents don't depend on PostgREST embed nesting: the reward's title/emoji and
// the kid's display info are lifted to the top level.
export interface FulfillmentItem {
  id: string;
  kid_id: string;
  reward_id: string;
  cost: number;
  status: Database['public']['Enums']['purchase_status'];
  purchased_at: string;
  given_at: string | null;
  reward_title: string;
  reward_emoji: string | null;
  kid_display_name: string;
  kid_avatar_url: string | null;
}

// --- Rewards catalog ----------------------------------------------------------

// All rewards in the family (active and inactive), newest first. (Parent
// management, #22.)
export function listRewards(client: LootLoopClient) {
  return client.from('rewards').select('*').order('created_at', { ascending: false });
}

// Only active rewards, cheapest first — the kid browse/shop view (#23).
export function listActiveRewards(client: LootLoopClient) {
  return client.from('rewards').select('*').eq('active', true).order('cost', { ascending: true });
}

export function createReward(client: LootLoopClient, input: RewardInsert) {
  return client.from('rewards').insert(input).select().single();
}

export function updateReward(client: LootLoopClient, id: string, patch: RewardUpdate) {
  return client.from('rewards').update(patch).eq('id', id).select().single();
}

export function deleteReward(client: LootLoopClient, id: string) {
  return client.from('rewards').delete().eq('id', id);
}

// --- Purchase (atomic) --------------------------------------------------------

// Buy a reward → decrements the wallet, writes the spend ledger row + the
// reward_purchases row atomically (task #24). Self-authorizing in the SQL
// function (parent OR the owning kid in-family). Returns the new purchase id.
export function purchaseReward(client: LootLoopClient, rewardId: string, kidId: string) {
  return client.rpc('purchase_reward', { p_reward_id: rewardId, p_kid_id: kidId });
}

// --- Fulfillment queue (#25) --------------------------------------------------

// Purchases for the fulfillment queue. Embeds the reward (title, emoji) and the
// kid via the kid_id -> profiles FK, then flattens to FulfillmentItem. Filters
// by status (default 'purchased' = the unfulfilled queue), newest first.
export async function listPurchases(
  client: LootLoopClient,
  status: 'purchased' | 'given' = 'purchased',
): Promise<{
  data: FulfillmentItem[] | null;
  error: import('@supabase/supabase-js').PostgrestError | null;
}> {
  const { data, error } = await client
    .from('reward_purchases')
    .select(
      `id, kid_id, reward_id, cost, status, purchased_at, given_at,
       rewards ( title, emoji ),
       profiles!reward_purchases_kid_id_fkey ( display_name, avatar_url )`,
    )
    .eq('status', status)
    .order('purchased_at', { ascending: false });

  if (error || !data) return { data: null, error };

  const rows = data as unknown as Array<{
    id: string;
    kid_id: string;
    reward_id: string;
    cost: number;
    status: Database['public']['Enums']['purchase_status'];
    purchased_at: string;
    given_at: string | null;
    rewards: { title: string; emoji: string | null } | null;
    profiles: { display_name: string; avatar_url: string | null } | null;
  }>;

  const flattened: FulfillmentItem[] = rows.map(r => ({
    id: r.id,
    kid_id: r.kid_id,
    reward_id: r.reward_id,
    cost: r.cost,
    status: r.status,
    purchased_at: r.purchased_at,
    given_at: r.given_at,
    reward_title: r.rewards?.title ?? '',
    reward_emoji: r.rewards?.emoji ?? null,
    kid_display_name: r.profiles?.display_name ?? '',
    kid_avatar_url: r.profiles?.avatar_url ?? null,
  }));

  return { data: flattened, error: null };
}

// Mark a purchase fulfilled (parents may UPDATE reward_purchases per RLS).
export function markPurchaseGiven(client: LootLoopClient, purchaseId: string, givenBy: string) {
  return client
    .from('reward_purchases')
    .update({
      status: 'given',
      given_by: givenBy,
      given_at: new Date().toISOString(),
    })
    .eq('id', purchaseId);
}
