// Realtime subscription helper (task #41), shared by web + mobile. Wraps
// supabase-js Postgres Changes so screens can react to live DB changes (a parent
// approves a chore -> the kid's wallet/list update without a refetch).
//
// AUTH: a PARENT uses a Supabase Auth (GoTrue) session, so supabase-js already
// hands its token to Realtime. A KID uses a custom HS256 JWT (no GoTrue session)
// built via createKidClient — Realtime won't pick that up from the global header,
// so the kid client must call setKidRealtimeAuth(client, token) once before
// subscribing, so Realtime authorizes the kid against RLS.
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { LootLoopClient } from './auth';

// Give Realtime the kid's access token so RLS-scoped change events are delivered
// to the kid principal. Call once after building a kid client (no-op-safe to call
// again on token refresh). Parents don't need this.
export function setKidRealtimeAuth(client: LootLoopClient, accessToken: string): void {
  client.realtime.setAuth(accessToken);
}

export type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface SubscribeOptions {
  table: string;
  // PostgREST-style filter, e.g. `family_id=eq.<uuid>` or `kid_id=eq.<uuid>`.
  filter?: string;
  event?: ChangeEvent;
  onChange: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  // Optional explicit channel name; defaults to a unique generated one.
  channelName?: string;
}

let channelSeq = 0;

// Subscribe to Postgres change events on a public table. Returns an unsubscribe
// fn (removes the channel). Screens typically: subscribe in an effect filtered by
// family_id/kid_id with onChange = a debounced refetch, and call the returned fn
// on unmount.
export function subscribeToTable(client: LootLoopClient, opts: SubscribeOptions): () => void {
  const name = opts.channelName ?? `rt:${opts.table}:${(channelSeq += 1)}`;
  const channel = client
    .channel(name)
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'postgres_changes' as any,
      { event: opts.event ?? '*', schema: 'public', table: opts.table, filter: opts.filter },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => opts.onChange(payload),
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
