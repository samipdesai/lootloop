// Chore data service (task #11), shared by web + mobile parent surfaces. Mirrors
// auth.ts: each fn takes the Supabase client first and returns the awaited
// PostgREST result ({ data, error }) or the rpc promise. RLS (002) scopes every
// query to the caller's family; the atomic award path (003) runs through the
// award_points_on_approval RPC.
import type { Database } from '@lootloop/types';
import type { LootLoopClient } from './auth';

export type Chore = Database['public']['Tables']['chores']['Row'];
export type ChoreInsert = Database['public']['Tables']['chores']['Insert'];
export type ChoreUpdate = Database['public']['Tables']['chores']['Update'];
export type ChoreCompletion = Database['public']['Tables']['chore_completions']['Row'];
export type KidProfile = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'family_id' | 'display_name' | 'avatar_url' | 'age_mode'
>;

// Shape returned by listPendingCompletions for the Approval Queue. Flattened so
// UI agents don't depend on PostgREST embed nesting: the nested instance/chore
// fields and the kid's display info are lifted to the top level.
export interface PendingCompletion {
  id: string;
  kid_id: string;
  submitted_at: string;
  status: Database['public']['Enums']['completion_status'];
  due_date: string;
  points: number;
  chore_title: string;
  chore_icon: string | null;
  kid_display_name: string;
  kid_avatar_url: string | null;
}

// --- Parent identity ----------------------------------------------------------

// The signed-in parent's own profile. UI uses family_id (createChore) and id
// (reviewerId for approve/reject). Scoped by auth_user_id — NOT role='parent' —
// because a family can have multiple parents (co-parents); matching on role alone
// returns >1 row and maybeSingle() then errors. maybeSingle: no row before
// onboarding completes.
export async function getMyParentProfile(client: LootLoopClient): Promise<{
  data: { id: string; family_id: string; display_name: string } | null;
  error: { message: string } | null;
}> {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) {
    return { data: null, error: authError ?? new Error('Not authenticated') };
  }
  const { data, error } = await client
    .from('profiles')
    .select('id, family_id, display_name')
    .eq('auth_user_id', auth.user.id)
    .maybeSingle();
  return { data, error };
}

// --- Kids ---------------------------------------------------------------------

export function listKids(client: LootLoopClient) {
  return client
    .from('profiles')
    .select('id, family_id, display_name, avatar_url, age_mode')
    .eq('role', 'kid')
    .order('display_name', { ascending: true });
}

// --- Chores (parent-authored templates) --------------------------------------

// All chores in the family (active and inactive), newest first.
export function listChores(client: LootLoopClient) {
  return client.from('chores').select('*').order('created_at', { ascending: false });
}

export function getChore(client: LootLoopClient, id: string) {
  return client.from('chores').select('*').eq('id', id).maybeSingle();
}

export function createChore(client: LootLoopClient, input: ChoreInsert) {
  return client.from('chores').insert(input).select().single();
}

export function updateChore(client: LootLoopClient, id: string, patch: ChoreUpdate) {
  return client.from('chores').update(patch).eq('id', id).select().single();
}

export function deleteChore(client: LootLoopClient, id: string) {
  return client.from('chores').delete().eq('id', id);
}

// --- Approval queue -----------------------------------------------------------

// Pending completions for the Approval Queue. Embeds the instance (due_date,
// points), the instance's chore (title, icon), and the kid via the
// kid_id -> profiles FK, then flattens to PendingCompletion. Oldest first.
export async function listPendingCompletions(client: LootLoopClient): Promise<{
  data: PendingCompletion[] | null;
  error: import('@supabase/supabase-js').PostgrestError | null;
}> {
  const { data, error } = await client
    .from('chore_completions')
    .select(
      `id, kid_id, submitted_at, status,
       chore_instances ( due_date, points, chores ( title, icon ) ),
       profiles!chore_completions_kid_id_fkey ( display_name, avatar_url )`,
    )
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true });

  if (error || !data) return { data: null, error };

  const rows = data as unknown as Array<{
    id: string;
    kid_id: string;
    submitted_at: string;
    status: Database['public']['Enums']['completion_status'];
    chore_instances: {
      due_date: string;
      points: number;
      chores: { title: string; icon: string | null } | null;
    } | null;
    profiles: { display_name: string; avatar_url: string | null } | null;
  }>;

  const flattened: PendingCompletion[] = rows.map(r => ({
    id: r.id,
    kid_id: r.kid_id,
    submitted_at: r.submitted_at,
    status: r.status,
    due_date: r.chore_instances?.due_date ?? '',
    points: r.chore_instances?.points ?? 0,
    chore_title: r.chore_instances?.chores?.title ?? '',
    chore_icon: r.chore_instances?.chores?.icon ?? null,
    kid_display_name: r.profiles?.display_name ?? '',
    kid_avatar_url: r.profiles?.avatar_url ?? null,
  }));

  return { data: flattened, error: null };
}

// Approve a completion → awards the instance points snapshot atomically (task #18).
// Idempotent + self-authorizing in the SQL function.
export function approveCompletion(
  client: LootLoopClient,
  completionId: string,
  reviewerId: string,
) {
  return client.rpc('award_points_on_approval', {
    p_completion_id: completionId,
    p_reviewer_id: reviewerId,
  });
}

// Reject a completion (parents may UPDATE completions directly per RLS). No
// points are awarded.
export function rejectCompletion(client: LootLoopClient, completionId: string, reviewerId: string) {
  return client
    .from('chore_completions')
    .update({
      status: 'rejected',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', completionId);
}
