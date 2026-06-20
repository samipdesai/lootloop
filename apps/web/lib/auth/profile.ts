import type { LootLoopClient } from '@lootloop/client';

// Distinguishes the three gating states (spec §7):
//   'no-session'  → not logged in
//   'no-profile'  → confirmed session but bootstrap incomplete → /onboarding
//   'onboarded'   → has a parent profile → dashboard
export type GateState = 'no-session' | 'no-profile' | 'onboarded';

export async function getGateState(client: LootLoopClient): Promise<GateState> {
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return 'no-session';

  // RLS scopes this to the caller; we look for a parent profile owned by them.
  const { data } = await client
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('role', 'parent')
    .maybeSingle();

  return data ? 'onboarded' : 'no-profile';
}
