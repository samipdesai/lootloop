import { createClient } from '@supabase/supabase-js';
import type { SupabaseClientOptions } from '@supabase/supabase-js';
import type { Database } from '@lootloop/types';

// Optional auth overrides so each platform can supply its own session storage
// (mobile passes an AsyncStorage adapter + RN-appropriate flags). Web omits
// this and keeps supabase-js defaults — behavior unchanged.
type AuthOptions = NonNullable<SupabaseClientOptions<'public'>['auth']>;

export function createSupabaseClient(url: string, anonKey: string, auth?: AuthOptions) {
  return createClient<Database>(url, anonKey, auth ? { auth } : undefined);
}
