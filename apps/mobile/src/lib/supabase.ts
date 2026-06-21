// Mobile Supabase singleton. RN has no localStorage, so supabase-js needs an
// explicit AsyncStorage adapter plus RN-appropriate auth flags (no URL session
// detection; auto-refresh + persist on). The shared factory in @lootloop/client
// takes optional auth overrides — web omits them and keeps the defaults.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSupabaseClient } from '@lootloop/client';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_ANON_KEY — set them in apps/mobile/.env (loaded via react-native-config).',
  );
}

export const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  storage: AsyncStorage,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false,
});
