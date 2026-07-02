// Session + parent-profile state for the RootNavigator (#10). Subscribes to
// supabase.auth.onAuthStateChange and, whenever a session exists, looks up the
// caller's parent profile (RLS-scoped to auth.uid()). The navigator branches on
// { status, hasProfile, isRecovery } to pick splash / auth stack / parent shell.
//
// Resilience: the profile lookup also re-runs on app foreground (not just on
// auth events), and a *transient* lookup failure is NOT treated as "no profile"
// — it stays on the current screen and retries with backoff — so a backend blip
// can't strand an existing parent on onboarding until they sign out and back in.
// Token auto-refresh is tied to AppState per the supabase-js RN requirement.
//
// Kept as a small React context rather than pulling in Zustand for a single
// store — CLAUDE.md prefers minimal dependencies; swap to Zustand later if
// shared mutable state grows.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

export interface SessionState {
  status: SessionStatus;
  session: Session | null;
  hasParentProfile: boolean;
  // A PASSWORD_RECOVERY session must NOT be treated as a full login — the reset
  // screen renders even though a session technically exists (spec §7).
  isRecovery: boolean;
}

const initialState: SessionState = {
  status: 'loading',
  session: null,
  hasParentProfile: false,
  isRecovery: false,
};

const SessionContext = createContext<SessionState>(initialState);

// Tri-state: distinguish a genuine "no parent profile yet" (→ onboarding) from a
// transient lookup failure (→ retry, never onboarding).
type ProfileLookup = 'present' | 'absent' | 'error';

async function lookupParentProfile(authUserId: string): Promise<ProfileLookup> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .eq('role', 'parent')
    .maybeSingle();
  if (error) return 'error';
  return data != null ? 'present' : 'absent';
}

const MAX_RETRY_MS = 30_000;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(initialState);
  // Guards async profile lookups so a stale result can't overwrite a newer one.
  const requestSeq = useRef(0);
  // Latest session + recovery flag, so a foreground event or a backoff retry can
  // re-run the lookup without waiting for a fresh auth event.
  const sessionRef = useRef<Session | null>(null);
  const isRecoveryRef = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearRetry = () => {
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
    };

    // attempt drives the retry backoff for consecutive lookup errors.
    const apply = async (session: Session | null, isRecovery: boolean, attempt = 0) => {
      const seq = ++requestSeq.current;
      sessionRef.current = session;
      isRecoveryRef.current = isRecovery;
      clearRetry();

      if (!session) {
        if (seq === requestSeq.current) {
          setState({ status: 'signedOut', session: null, hasParentProfile: false, isRecovery: false });
        }
        return;
      }

      const result = await lookupParentProfile(session.user.id);
      if (seq !== requestSeq.current) return; // superseded by a newer apply()

      if (result === 'error') {
        // Transient backend failure: keep the current screen (Splash on first
        // load; the parent shell if already resolved) and retry with capped
        // backoff. Foreground also kicks a fresh attempt. Never fall through to
        // hasParentProfile:false — that would misroute an existing parent to
        // onboarding until they manually re-login.
        const delay = Math.min(2000 * 2 ** attempt, MAX_RETRY_MS);
        retryTimer.current = setTimeout(() => {
          void apply(sessionRef.current, isRecoveryRef.current, attempt + 1);
        }, delay);
        return;
      }

      setState({ status: 'signedIn', session, hasParentProfile: result === 'present', isRecovery });
    };

    // Seed from any persisted session, then react to auth events.
    void supabase.auth.getSession().then(({ data }) => {
      void apply(data.session, false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      void apply(session, event === 'PASSWORD_RECOVERY');
    });

    // Token auto-refresh must follow the app lifecycle on React Native
    // (supabase-js requirement): resume on foreground, pause on background.
    // Foreground also re-runs the profile lookup so a session/backend issue that
    // cleared while the app was backgrounded self-heals without a manual logout.
    const onAppStateChange = (next: string) => {
      if (next === 'active') {
        supabase.auth.startAutoRefresh();
        if (sessionRef.current) void apply(sessionRef.current, isRecoveryRef.current);
      } else {
        supabase.auth.stopAutoRefresh();
      }
    };
    if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();
    const appSub = AppState.addEventListener('change', onAppStateChange);

    return () => {
      sub.subscription.unsubscribe();
      appSub.remove();
      clearRetry();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
