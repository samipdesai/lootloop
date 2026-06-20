'use client';

import { useEffect } from 'react';
import { checkConnection } from '@lootloop/client';

// Renders nothing; logs Supabase connection status once on mount (task #7).
export function ConnectionProbe() {
  useEffect(() => {
    void checkConnection(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      'web',
    );
  }, []);
  return null;
}
