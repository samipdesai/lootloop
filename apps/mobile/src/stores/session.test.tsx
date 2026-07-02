import React from 'react';
import { renderHook, waitFor, act } from '../test-utils/renderHook';

// --- Supabase boundary mock ----------------------------------------------
// Mock ../lib/supabase (the only place the store touches Supabase) so we drive
// getSession, the auth-state subscription, and the profiles lookup by hand.
const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockMaybeSingle = jest.fn();
const mockUnsubscribe = jest.fn();

// profiles().select().eq().eq().maybeSingle() — each link returns the builder.
const queryBuilder: Record<string, jest.Mock> = {};
queryBuilder.select = jest.fn(() => queryBuilder);
queryBuilder.eq = jest.fn(() => queryBuilder);
queryBuilder.maybeSingle = mockMaybeSingle;
const mockFrom = jest.fn((_table: string) => queryBuilder);

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (cb: AuthCb) => mockOnAuthStateChange(cb),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
  },
}));

import { SessionProvider, useSession } from './session';
import type { Session } from '@supabase/supabase-js';

type AuthCb = (event: string, session: Session | null) => void;

const fakeSession = (userId = 'u1'): Session =>
  ({ user: { id: userId } } as unknown as Session);

// Capture the auth-state callback the provider registers so tests can emit events.
let emittedCb: AuthCb | undefined;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SessionProvider>{children}</SessionProvider>
);
const renderSession = () => renderHook(() => useSession(), { wrapper });

beforeEach(() => {
  mockGetSession.mockReset();
  mockOnAuthStateChange.mockReset();
  mockMaybeSingle.mockReset();
  mockUnsubscribe.mockReset();
  mockFrom.mockClear();
  queryBuilder.select.mockClear();
  queryBuilder.eq.mockClear();
  emittedCb = undefined;

  mockOnAuthStateChange.mockImplementation((cb: AuthCb) => {
    emittedCb = cb;
    return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
  });
});

describe('SessionProvider seeding from a persisted session', () => {
  it('resolves to signedOut when getSession returns no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const { result } = renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.session).toBeNull();
    expect(result.current.hasParentProfile).toBe(false);
    expect(result.current.isRecovery).toBe(false);
    // No session → never queries profiles.
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('resolves to signedIn WITH a parent profile when one exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession('u9') } });
    mockMaybeSingle.mockResolvedValue({ data: { id: 'p1' }, error: null });

    const { result } = renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    expect(result.current.hasParentProfile).toBe(true);
    expect(result.current.isRecovery).toBe(false);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    // Scoped to the auth user id and the parent role.
    expect(queryBuilder.eq).toHaveBeenCalledWith('auth_user_id', 'u9');
    expect(queryBuilder.eq).toHaveBeenCalledWith('role', 'parent');
  });

  it('signedIn WITHOUT a profile when the lookup returns null data', async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession() } });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { result } = renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    expect(result.current.hasParentProfile).toBe(false);
  });

  it('does NOT treat a transient lookup error as "no profile" (no onboarding misroute)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession() } });
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const { result, unmount } = renderSession();
    // The lookup runs and errors...
    await waitFor(() => expect(mockMaybeSingle).toHaveBeenCalled());
    // ...but we stay on loading (Splash) and retry, rather than flipping to
    // signedIn-without-profile, which the navigator would render as onboarding.
    expect(result.current.status).toBe('loading');
    expect(result.current.hasParentProfile).toBe(false);
    unmount(); // clears the pending backoff-retry timer
  });

  it('recovers to signedIn when a later re-check succeeds (e.g. token refresh / foreground)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession('u3') } });
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
      .mockResolvedValue({ data: { id: 'p1' }, error: null });

    const { result, unmount } = renderSession();
    await waitFor(() => expect(mockMaybeSingle).toHaveBeenCalledTimes(1));
    expect(result.current.status).toBe('loading');

    // A later auth event (token refresh, re-login) re-runs the lookup, which now
    // succeeds — the user self-heals without a manual sign-out. This also clears
    // the pending backoff-retry timer.
    await act(async () => {
      emittedCb!('TOKEN_REFRESHED', fakeSession('u3'));
    });
    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    expect(result.current.hasParentProfile).toBe(true);
    unmount();
  });
});

describe('auth-state-change events', () => {
  it('flips to signedOut on a SIGNED_OUT event', async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession() } });
    mockMaybeSingle.mockResolvedValue({ data: { id: 'p1' }, error: null });

    const { result } = renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedIn'));

    await act(async () => {
      emittedCb!('SIGNED_OUT', null);
    });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.session).toBeNull();
    expect(result.current.hasParentProfile).toBe(false);
  });

  it('marks isRecovery=true on a PASSWORD_RECOVERY event (not treated as a full login)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockMaybeSingle.mockResolvedValue({ data: { id: 'p1' }, error: null });

    const { result } = renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(async () => {
      emittedCb!('PASSWORD_RECOVERY', fakeSession());
    });
    await waitFor(() => expect(result.current.isRecovery).toBe(true));
    expect(result.current.status).toBe('signedIn');
  });

  it('a SIGNED_IN event leaves isRecovery false', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockMaybeSingle.mockResolvedValue({ data: { id: 'p1' }, error: null });

    const { result } = renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(async () => {
      emittedCb!('SIGNED_IN', fakeSession());
    });
    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    expect(result.current.isRecovery).toBe(false);
  });

  it('ignores a stale profile lookup that resolves after a newer event (requestSeq guard)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    // First (older) sign-in: a lookup that we hold open via a deferred promise.
    let resolveStale!: (v: { data: unknown; error: null }) => void;
    const stalePromise = new Promise<{ data: unknown; error: null }>((res) => {
      resolveStale = res;
    });
    mockMaybeSingle.mockReturnValueOnce(stalePromise);

    const { result } = renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(async () => {
      emittedCb!('SIGNED_IN', fakeSession('old'));
    });

    // A newer sign-out supersedes the in-flight lookup.
    await act(async () => {
      emittedCb!('SIGNED_OUT', null);
    });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    // The stale lookup now resolves "with a profile" — it must NOT flip us back
    // to signedIn, because its seq no longer matches requestSeq.current.
    await act(async () => {
      resolveStale({ data: { id: 'p1' }, error: null });
      await stalePromise;
    });
    expect(result.current.status).toBe('signedOut');
    expect(result.current.hasParentProfile).toBe(false);
  });
});

describe('subscription lifecycle', () => {
  it('unsubscribes from auth changes on unmount', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const { result, unmount } = renderSession();
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('useSession outside a provider', () => {
  it('returns the loading initial state', () => {
    const { result } = renderHook(() => useSession());
    expect(result.current.status).toBe('loading');
    expect(result.current.session).toBeNull();
    expect(result.current.hasParentProfile).toBe(false);
    expect(result.current.isRecovery).toBe(false);
  });
});
