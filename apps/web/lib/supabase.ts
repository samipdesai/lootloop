import { createSupabaseClient } from '@lootloop/client';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — copy apps/web/.env.local.example to apps/web/.env.local',
  );
}

export const supabase = createSupabaseClient(url, anonKey);
