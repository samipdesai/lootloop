// Session + parent-profile state for the RootNavigator (#10). Subscribes to
// supabase.auth.onAuthStateChange and, whenever a session exists, looks up the
// caller's parent profile (RLS-scoped to auth.uid()). The navigator branches on
// { status, hasProfile, isRecovery } to pick splash / auth stack / parent shell.
//
// Kept as a small React context rather than pulling in Zustand for a single
// store — CLAUDE.md prefers minimal dependencies; swap to Zustand later if
// shared mutable state grows.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
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

async function lookupParentProfile(authUserId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .eq('role', 'parent')
    .maybeSingle();
  if (error) {
    // Treat lookup failure as "no profile yet" so the user lands on onboarding
    // rather than a broken shell; a retry on next auth event will correct it.
    return false;
  }
  return data != null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(initialState);
  // Guards async profile lookups so a stale result can't overwrite a newer one.
  const requestSeq = useRef(0);

  useEffect(() => {
    const apply = async (session: Session | null, isRecovery: boolean) => {
      const seq = ++requestSeq.current;
      if (!session) {
        if (seq === requestSeq.current) {
          setState({ status: 'signedOut', session: null, hasParentProfile: false, isRecovery: false });
        }
        return;
      }
      const hasProfile = await lookupParentProfile(session.user.id);
      if (seq === requestSeq.current) {
        setState({ status: 'signedIn', session, hasParentProfile: hasProfile, isRecovery });
      }
    };

    // Seed from any persisted session, then react to auth events.
    void supabase.auth.getSession().then(({ data }) => {
      void apply(data.session, false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      void apply(session, event === 'PASSWORD_RECOVERY');
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
