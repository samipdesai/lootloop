// Kid-session chore data (tasks #15 / #16). Called with a KID client
// (createKidClient — carries the kid JWT). RLS (migration 002) scopes reads to
// the family (chores / chore_instances whole-family SELECT) and lets the kid
// INSERT/UPDATE their OWN chore_completion while claimed/pending. The flattened
// KidChore shape is the contract the kid Today screen builds against, so it does
// not depend on PostgREST embed nesting.
import type { Database } from '@lootloop/types';
import type { PostgrestError } from '@supabase/supabase-js';
import type { LootLoopClient } from './auth';

type ChoreCompletionRow = Database['public']['Tables']['chore_completions']['Row'];

// Explicit return type so the inferred PostgREST builder types (which differ
// between insert and update paths) don't leak a non-portable module reference.
type CompletionResult = { data: ChoreCompletionRow | null; error: PostgrestError | null };

export interface KidChore {
  instance_id: string;
  chore_id: string;
  title: string;
  icon: string | null;
  points: number;
  assignment: Database['public']['Enums']['chore_assignment'];
  assigned_kid_id: string | null;
  due_date: string;
  completion_id: string | null;
  status: Database['public']['Enums']['completion_status'] | null;
}

// chore_instances for due_date, embedding the parent chore (for title / icon /
// assignment) and THIS kid's completion (filtered to kid_id) for status. We
// embed both, then in JS: keep only active chores that are assigned to this kid
// OR shared, and flatten. The completion embed is filtered server-side to the
// kid via the .eq() on the embedded resource so a shared instance another kid
// claimed doesn't leak its status here.
export async function listKidChores(
  kidClient: LootLoopClient,
  kidId: string,
  dueDate: string,
): Promise<{ data: KidChore[] | null; error: PostgrestError | null }> {
  const { data, error } = await kidClient
    .from('chore_instances')
    .select(
      `id, chore_id, points, due_date,
       chores!inner ( title, icon, assignment, assigned_kid_id, active ),
       chore_completions ( id, status, kid_id )`,
    )
    .eq('due_date', dueDate)
    .eq('chores.active', true)
    .eq('chore_completions.kid_id', kidId);

  if (error || !data) return { data: null, error };

  const rows = data as unknown as Array<{
    id: string;
    chore_id: string;
    points: number;
    due_date: string;
    chores: {
      title: string;
      icon: string | null;
      assignment: Database['public']['Enums']['chore_assignment'];
      assigned_kid_id: string | null;
      active: boolean;
    } | null;
    chore_completions: Array<{
      id: string;
      status: Database['public']['Enums']['completion_status'];
      kid_id: string;
    }>;
  }>;

  const result: KidChore[] = [];
  for (const r of rows) {
    const chore = r.chores;
    if (!chore) continue;
    // This kid's instances: assigned directly to them, or shared (claimable by
    // anyone in the family). Skip chores assigned to a different kid.
    const mine =
      chore.assignment === 'shared' ||
      (chore.assignment === 'assigned' && chore.assigned_kid_id === kidId);
    if (!mine) continue;

    const completion = r.chore_completions[0] ?? null;
    result.push({
      instance_id: r.id,
      chore_id: r.chore_id,
      title: chore.title,
      icon: chore.icon,
      points: r.points,
      assignment: chore.assignment,
      assigned_kid_id: chore.assigned_kid_id,
      due_date: r.due_date,
      completion_id: completion?.id ?? null,
      status: completion?.status ?? null,
    });
  }

  return { data: result, error: null };
}

// Resolve the instance's family_id so the inserted completion satisfies the
// kid_insert RLS check (family_id = auth_family_id() AND kid_id = auth_profile_id()).
async function instanceFamilyId(
  kidClient: LootLoopClient,
  instanceId: string,
): Promise<{ familyId: string | null; error: PostgrestError | null }> {
  const { data, error } = await kidClient
    .from('chore_instances')
    .select('family_id')
    .eq('id', instanceId)
    .maybeSingle();
  return { familyId: data?.family_id ?? null, error };
}

// Claim a SHARED chore: insert a 'claimed' completion for this kid. RLS requires
// kid_id = auth_profile_id(); family_id is read from the instance.
export async function claimChore(
  kidClient: LootLoopClient,
  instanceId: string,
  kidId: string,
): Promise<CompletionResult> {
  const { familyId, error: famErr } = await instanceFamilyId(kidClient, instanceId);
  if (famErr || !familyId) {
    return { data: null, error: famErr };
  }
  return kidClient
    .from('chore_completions')
    .insert({
      chore_instance_id: instanceId,
      kid_id: kidId,
      status: 'claimed',
      family_id: familyId,
    })
    .select()
    .single();
}

// Submit a chore for parent approval. If the kid already has a completion row
// (e.g. a claimed shared chore), UPDATE it to 'pending'; otherwise INSERT a
// 'pending' row (the common assigned-chore path — no prior claim). Works for
// both assigned and shared-claimed chores.
export async function completeChore(
  kidClient: LootLoopClient,
  instanceId: string,
  kidId: string,
): Promise<CompletionResult> {
  const { data: existing, error: findErr } = await kidClient
    .from('chore_completions')
    .select('id')
    .eq('chore_instance_id', instanceId)
    .eq('kid_id', kidId)
    .maybeSingle();
  if (findErr) {
    return { data: null, error: findErr };
  }

  if (existing) {
    return kidClient
      .from('chore_completions')
      .update({ status: 'pending' })
      .eq('id', existing.id)
      .select()
      .single();
  }

  const { familyId, error: famErr } = await instanceFamilyId(kidClient, instanceId);
  if (famErr || !familyId) {
    return { data: null, error: famErr };
  }
  return kidClient
    .from('chore_completions')
    .insert({
      chore_instance_id: instanceId,
      kid_id: kidId,
      status: 'pending',
      family_id: familyId,
    })
    .select()
    .single();
}
