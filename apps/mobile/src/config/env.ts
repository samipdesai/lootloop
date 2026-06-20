import Config from 'react-native-config';

// Loaded from apps/mobile/.env via react-native-config (native build-time injection).
// Values are strings or undefined (if the key is absent from .env).
export const SUPABASE_URL = Config.SUPABASE_URL;
export const SUPABASE_ANON_KEY = Config.SUPABASE_ANON_KEY;
