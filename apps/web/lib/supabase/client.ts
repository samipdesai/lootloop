import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@lootloop/types';
import type { LootLoopClient } from '@lootloop/client';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — copy apps/web/.env.local.example to apps/web/.env.local',
  );
}

// Cookie-based browser client so the server (middleware + RSC) can read the
// session for route gating. Passed into @lootloop/client auth helpers.
export function createClient(): LootLoopClient {
  return createBrowserClient<Database>(url!, anonKey!);
}
