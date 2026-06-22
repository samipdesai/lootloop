// Reading log + streak service (tasks #27-#30), shared by web + mobile. Mirrors
// chores.ts: each fn takes the Supabase client first and returns the awaited
// PostgREST result ({ data, error }) or the rpc promise. RLS (002): a kid
// inserts/edits their own log while pending; parents see all + may update
// (approve/reject). reading_streaks is SELECT-only. The atomic approve path
// (007) runs through the approve_reading_log RPC (awards points + advances the
// streak in one transaction).
import type { Database } from '@lootloop/types';
import type { LootLoopClient } from './auth';

export type ReadingLog = Database['public']['Tables']['reading_logs']['Row'];
export type ReadingLogInsert = Database['public']['Tables']['reading_logs']['Insert'];
export type ReadingStreak = Database['public']['Tables']['reading_streaks']['Row'];

// Shape returned by listPendingReadingLogs for the approval queue. Flattened so
// UI agents don't depend on PostgREST embed nesting: the kid's display info is
// lifted to the top level.
export interface PendingReadingLog {
  id: string;
  kid_id: string;
  book_title: string;
  minutes: number;
  read_on: string;
  created_at: string;
  kid_display_name: string;
  kid_avatar_url: string | null;
}

// --- Kid: log + own reads -----------------------------------------------------

// Kid logs their own reading (family_id, kid_id, book_title, minutes, read_on?).
// read_on defaults to current_date in the schema when omitted. (#27, kid session.)
export function createReadingLog(client: LootLoopClient, input: ReadingLogInsert) {
  return client.from('reading_logs').insert(input).select().single();
}

// A kid's reading logs (any status), most-recently-read first. (#30 — kid view
// or a parent's per-kid drill-down.)
export function listKidReadingLogs(client: LootLoopClient, kidId: string) {
  return client
    .from('reading_logs')
    .select('*')
    .eq('kid_id', kidId)
    .order('read_on', { ascending: false })
    .order('created_at', { ascending: false });
}

// A kid's reading streak (current + longest). maybeSingle: one row per kid,
// bootstrapped by the 003 trigger, but stay null-safe. (#30.)
export function getReadingStreak(client: LootLoopClient, kidId: string) {
  return client.from('reading_streaks').select('*').eq('kid_id', kidId).maybeSingle();
}

// --- Approval queue (#28) -----------------------------------------------------

// Pending reading logs for the approval queue. Embeds the kid via the
// kid_id -> profiles FK, then flattens to PendingReadingLog. Oldest first.
export async function listPendingReadingLogs(client: LootLoopClient): Promise<{
  data: PendingReadingLog[] | null;
  error: import('@supabase/supabase-js').PostgrestError | null;
}> {
  const { data, error } = await client
    .from('reading_logs')
    .select(
      `id, kid_id, book_title, minutes, read_on, created_at,
       profiles!reading_logs_kid_id_fkey ( display_name, avatar_url )`,
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error || !data) return { data: null, error };

  const rows = data as unknown as Array<{
    id: string;
    kid_id: string;
    book_title: string;
    minutes: number;
    read_on: string;
    created_at: string;
    profiles: { display_name: string; avatar_url: string | null } | null;
  }>;

  const flattened: PendingReadingLog[] = rows.map(r => ({
    id: r.id,
    kid_id: r.kid_id,
    book_title: r.book_title,
    minutes: r.minutes,
    read_on: r.read_on,
    created_at: r.created_at,
    kid_display_name: r.profiles?.display_name ?? '',
    kid_avatar_url: r.profiles?.avatar_url ?? null,
  }));

  return { data: flattened, error: null };
}

// Approve a reading log → awards points + advances the streak atomically (task
// #28/#29). Idempotent + self-authorizing (parent-only, own family) in the SQL
// function. Returns the 'earn' ledger row id.
export function approveReadingLog(
  client: LootLoopClient,
  readingId: string,
  reviewerId: string,
  points: number,
) {
  return client.rpc('approve_reading_log', {
    p_reading_id: readingId,
    p_reviewer_id: reviewerId,
    p_points: points,
  });
}

// Reject a reading log (parents may UPDATE reading_logs directly per RLS). No
// points are awarded.
export function rejectReadingLog(client: LootLoopClient, readingId: string, reviewerId: string) {
  return client
    .from('reading_logs')
    .update({
      status: 'rejected',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', readingId);
}
