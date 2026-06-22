// Daily-schedule service (tasks #36-#37), shared by web + mobile parent surfaces
// (#36 schedule CRUD) and the kid timeline (#37). Mirrors chores.ts: each fn
// takes the Supabase client first and returns the awaited PostgREST result
// ({ data, error }). RLS (002) scopes every query to the caller's family:
// whole-family SELECT; parent-only insert/update/delete. days_of_week is an ISO
// weekday array (1=Mon..7=Sun); empty '{}' means every day — the kid timeline
// filters by today's weekday client-side.
import type { Database } from '@lootloop/types';
import type { LootLoopClient } from './auth';

export type ScheduleItem = Database['public']['Tables']['schedule_items']['Row'];
export type ScheduleItemInsert = Database['public']['Tables']['schedule_items']['Insert'];
export type ScheduleItemUpdate = Database['public']['Tables']['schedule_items']['Update'];

// --- Parent management overview (#36) ----------------------------------------

// All schedule items in the family (active and inactive), ordered by kid then
// start_time so the parent management view groups per kid in time order.
export function listScheduleItems(client: LootLoopClient) {
  return client
    .from('schedule_items')
    .select('*')
    .order('kid_id', { ascending: true })
    .order('start_time', { ascending: true });
}

// A kid's active schedule items, earliest first — the kid timeline (#37). The
// screen filters by today's weekday client-side using days_of_week.
export function listKidScheduleItems(client: LootLoopClient, kidId: string) {
  return client
    .from('schedule_items')
    .select('*')
    .eq('kid_id', kidId)
    .eq('active', true)
    .order('start_time', { ascending: true });
}

// --- CRUD (parent-only per RLS) ----------------------------------------------

export function createScheduleItem(client: LootLoopClient, input: ScheduleItemInsert) {
  return client.from('schedule_items').insert(input).select().single();
}

export function updateScheduleItem(client: LootLoopClient, id: string, patch: ScheduleItemUpdate) {
  return client.from('schedule_items').update(patch).eq('id', id).select().single();
}

export function deleteScheduleItem(client: LootLoopClient, id: string) {
  return client.from('schedule_items').delete().eq('id', id);
}
