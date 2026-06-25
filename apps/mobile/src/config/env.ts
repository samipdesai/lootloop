import Config from 'react-native-config';

// Loaded from apps/mobile/.env via react-native-config (native build-time injection).
// Values are strings or undefined (if the key is absent from .env).
export const SUPABASE_URL = Config.SUPABASE_URL;
export const SUPABASE_ANON_KEY = Config.SUPABASE_ANON_KEY;

// Sentry DSN (task #61). Absent in .env (dev) → Sentry off; set in .env.production
// (release) → reporting on. Public value, safe to bake into the build.
export const SENTRY_DSN = Config.SENTRY_DSN;
