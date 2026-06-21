// Kid session state for the RootNavigator (#9-client). A kid is NOT a Supabase
// Auth user — they log in by family code + PIN (family-roster + kid-auth Edge
// Functions) and get a custom HS256 JWT. We persist that token (+ profile) in
// AsyncStorage and rebuild a bearer-authed Supabase client on launch, so a kid
// stays signed in across restarts until the token's lifetime elapses.
//
// Kept as a small React context (mirrors stores/session.tsx — CLAUDE.md prefers
// minimal deps over pulling in Zustand for a single store).
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createKidClient, type KidAuthResult, type LootLoopClient } from '@lootloop/client';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';

const STORAGE_KEY = 'lootloop.kidSession.v1';

export type KidSessionStatus = 'loading' | 'signedOut' | 'signedIn';

export type KidProfile = KidAuthResult['profile'];

// What we persist. expiresAt is an absolute epoch-ms deadline derived from the
// edge function's expires_in, so we never have to decode the JWT to know it's
// stale.
interface StoredKidSession {
  access_token: string;
  profile: KidProfile;
  expiresAt: number;
}

export interface KidSessionState {
  status: KidSessionStatus;
  profile: KidProfile | null;
  // A Supabase client that sends the kid JWT as a static bearer header. Null
  // when signed out. Kid screens use THIS client for all reads/writes.
  client: LootLoopClient | null;
  signIn: (result: KidAuthResult) => Promise<void>;
  signOut: () => Promise<void>;
}

const KidSessionContext = createContext<KidSessionState | null>(null);

function buildClient(accessToken: string): LootLoopClient {
  // The singleton (lib/supabase) already guarantees these are set at runtime.
  return createKidClient(SUPABASE_URL as string, SUPABASE_ANON_KEY as string, accessToken);
}

export function KidSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<KidSessionStatus>('loading');
  const [profile, setProfile] = useState<KidProfile | null>(null);
  const [client, setClient] = useState<LootLoopClient | null>(null);

  // Rehydrate any persisted kid session on launch; drop it if expired.
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          if (active) setStatus('signedOut');
          return;
        }
        const stored = JSON.parse(raw) as StoredKidSession;
        if (!stored.access_token || stored.expiresAt <= Date.now()) {
          await AsyncStorage.removeItem(STORAGE_KEY);
          if (active) setStatus('signedOut');
          return;
        }
        if (active) {
          setProfile(stored.profile);
          setClient(buildClient(stored.access_token));
          setStatus('signedIn');
        }
      } catch {
        // Corrupt/unreadable storage -> treat as signed out (clean slate).
        if (active) setStatus('signedOut');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useMemo(
    () => async (result: KidAuthResult) => {
      const stored: StoredKidSession = {
        access_token: result.access_token,
        profile: result.profile,
        expiresAt: Date.now() + result.expires_in * 1000,
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      setProfile(result.profile);
      setClient(buildClient(result.access_token));
      setStatus('signedIn');
    },
    [],
  );

  const signOut = useMemo(
    () => async () => {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setProfile(null);
      setClient(null);
      setStatus('signedOut');
    },
    [],
  );

  const value = useMemo<KidSessionState>(
    () => ({ status, profile, client, signIn, signOut }),
    [status, profile, client, signIn, signOut],
  );

  return <KidSessionContext.Provider value={value}>{children}</KidSessionContext.Provider>;
}

export function useKidSession(): KidSessionState {
  const ctx = useContext(KidSessionContext);
  if (!ctx) throw new Error('useKidSession must be used within a KidSessionProvider');
  return ctx;
}
