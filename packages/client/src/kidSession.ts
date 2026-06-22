// Kid login + kid-session client (task #9-client). Two thin wrappers over the
// pre-auth Edge Functions (family-roster, kid-auth) plus a factory that builds a
// Supabase client carrying the minted KID JWT as a bearer header. Kids are NOT
// auth.users rows — there is no GoTrue session — so the kid client sends the
// token via a static Authorization header and disables GoTrue persistence /
// refresh. Every kid read/write (kidChores.ts) uses a client from
// createKidClient.
import { createClient } from '@supabase/supabase-js';
import type { FunctionsError } from '@supabase/supabase-js';
import type { Database } from '@lootloop/types';
import type { LootLoopClient } from './auth';
import type { AgeMode } from './kids';

export interface KidRosterEntry {
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
  age_mode: AgeMode;
}

export interface KidRoster {
  family_id: string;
  family_name: string;
  kids: KidRosterEntry[];
}

export interface KidAuthResult {
  access_token: string;
  token_type: string;
  expires_in: number;
  profile: {
    id: string;
    family_id: string;
    display_name: string;
    avatar_url: string | null;
    age_mode: AgeMode;
  };
}

// family-roster: POST { code } → { family_id, family_name, kids: [...] }. A
// non-2xx (bad/unknown code, rate limit) surfaces as a FunctionsHttpError; we
// pass it through as { data: null, error }.
export function bindFamilyByCode(
  client: LootLoopClient,
  code: string,
): Promise<{ data: KidRoster | null; error: FunctionsError | null }> {
  return client.functions.invoke<KidRoster>('family-roster', { body: { code } });
}

// kid-auth: POST { family_id, profile_id, pin } → KidAuthResult. A bad PIN /
// unknown kid is a 401 → FunctionsHttpError in `error`, data null.
export function signInKid(
  client: LootLoopClient,
  args: { family_id: string; profile_id: string; pin: string },
): Promise<{ data: KidAuthResult | null; error: FunctionsError | null }> {
  return client.functions.invoke<KidAuthResult>('kid-auth', { body: args });
}

// Build the client every kid read/write goes through. The KID JWT is attached as
// a static `Authorization: Bearer` header on every PostgREST/Realtime request so
// PostgREST treats the caller as the kid principal (ll_role='kid' claim → RLS
// helpers in migration 002). Auth persistence + autorefresh are off: this is a
// minted token, not a GoTrue session, so there is nothing to persist or refresh.
export function createKidClient(url: string, anonKey: string, accessToken: string): LootLoopClient {
  const client = createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  // Realtime auth is separate from the PostgREST bearer header: hand the kid JWT
  // to the Realtime socket so RLS-scoped change events are delivered (#41).
  // Verified end-to-end that a parent's award reaches the kid's subscription.
  client.realtime.setAuth(accessToken);
  return client;
}
