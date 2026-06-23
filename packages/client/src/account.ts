// Parent account & family deletion service (task #52). Thin wrappers over the
// `delete-account` Edge Function (supabase/functions/delete-account), which
// dispatches to the SECURITY DEFINER SQL functions leave_family()/delete_family()
// (migration 009) and then removes the freed auth.users rows via the GoTrue admin
// API. The parent's GoTrue session token is attached automatically by
// functions.invoke, and the SQL functions self-authorize off it — these wrappers
// add no client-side authZ. This is the ONLY backend-aware spot (portability rule:
// no raw supabase.from/.rpc in screens).
import type { FunctionsError } from '@supabase/supabase-js';
import type { LootLoopClient } from './auth';

export interface DeleteAccountResult {
  ok: true;
  action: 'leave' | 'delete_family';
  deleted_users: number;
}

type InvokeResult = Promise<{ data: DeleteAccountResult | null; error: FunctionsError | null }>;

// The calling parent leaves their family (removes only themselves). The Edge
// Function returns a non-2xx (-> FunctionsHttpError in `error`) if the caller is
// the LAST parent (403 last_parent) or not a parent (401) — the screen inspects
// `error` to message the user.
export function leaveFamily(client: LootLoopClient): InvokeResult {
  return client.functions.invoke<DeleteAccountResult>('delete-account', {
    body: { action: 'leave' },
  });
}

// Any parent deletes the ENTIRE family (HARD delete; FK CASCADE wipes all
// family-scoped data). A non-parent caller surfaces as a 401 in `error`.
export function deleteFamily(client: LootLoopClient): InvokeResult {
  return client.functions.invoke<DeleteAccountResult>('delete-account', {
    body: { action: 'delete_family' },
  });
}

// Classify a leaveFamily() error as the LAST-PARENT case (403 { error:
// "last_parent" }). functions.invoke surfaces non-2xx as a FunctionsHttpError
// whose `context` is the raw Response — reading its JSON body is the only way to
// distinguish the 403 last-parent guard from a generic failure. Kept here (not in
// the screen) so the HTTP/Edge-Function shape stays inside the backend-aware
// package (portability rule). Returns false for network errors / non-403s.
export async function isLastParentError(error: FunctionsError | null): Promise<boolean> {
  const res: unknown = error?.context;
  if (!(res instanceof Response) || res.status !== 403) return false;
  try {
    const body = (await res.clone().json()) as { error?: unknown };
    return body.error === 'last_parent';
  } catch {
    return false;
  }
}

// The signed-in parent's family name + kid count, for the delete-confirm screen
// (#52). RLS-scoped: families is visible only for id = auth_family_id(), and the
// kids head-count is restricted to the caller's family. maybeSingle stays
// null-safe before onboarding completes (mirrors getFamilyCode).
export async function getFamilySummary(
  client: LootLoopClient,
): Promise<{ data: { name: string; kid_count: number } | null; error: unknown }> {
  const [familyRes, kidsRes] = await Promise.all([
    client.from('families').select('name').maybeSingle(),
    // Kids are profiles with role='kid' (see listKids in chores.ts). RLS scopes
    // the count to the caller's family; head:true fetches the count only.
    client.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'kid'),
  ]);
  if (familyRes.error || !familyRes.data) return { data: null, error: familyRes.error };
  if (kidsRes.error) return { data: null, error: kidsRes.error };
  return { data: { name: familyRes.data.name, kid_count: kidsRes.count ?? 0 }, error: null };
}
