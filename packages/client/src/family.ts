// Co-parent management service, shared by web + mobile parent surfaces. Mirrors
// chores.ts: each fn takes the Supabase client first and returns the awaited
// PostgREST result ({ data, error }). RLS (002/004) scopes every query to the
// caller's family. Invite codes are minted via createFamilyInvite() in auth.ts;
// these helpers cover the roster + pending-invite reads and revoke.
import type { Database } from '@lootloop/types';
import type { LootLoopClient } from './auth';

export type Parent = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'display_name' | 'avatar_url' | 'auth_user_id'
>;

export type PendingInvite = Pick<
  Database['public']['Tables']['family_invites']['Row'],
  'id' | 'code' | 'created_at' | 'expires_at'
>;

// The family's parents (co-parents included), oldest first. RLS scopes to the
// caller's family. auth_user_id lets the UI tag the current parent as "(You)".
export function listParents(client: LootLoopClient) {
  return client
    .from('profiles')
    .select('id, display_name, avatar_url, auth_user_id')
    .eq('role', 'parent')
    .order('created_at', { ascending: true });
}

// Unused, unexpired invites for the family, newest first. The family_invites
// SELECT policy already limits this to the caller's own family (parents only).
export function listPendingInvites(client: LootLoopClient) {
  return client
    .from('family_invites')
    .select('id, code, created_at, expires_at')
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
}

// Revoke a pending invite. The family_invites DELETE policy enforces
// family + parent, so a bad id / other family simply deletes nothing.
export function revokeInvite(client: LootLoopClient, inviteId: string) {
  return client.from('family_invites').delete().eq('id', inviteId);
}
