import React from 'react';
import { renderHook, act, waitFor } from '../test-utils/renderHook';

// --- Boundary mocks -------------------------------------------------------
// createKidClient is the @lootloop/client boundary (builds the bearer-authed
// Supabase client). Mock it so no real network client is constructed and we can
// assert it's called with the right token.
const mockCreateKidClient = jest.fn((_url: string, _anon: string, token: string) => ({
  __kidClient: true,
  token,
}));
jest.mock('@lootloop/client', () => ({
  createKidClient: (url: string, anon: string, token: string) =>
    mockCreateKidClient(url, anon, token),
}));

// Local AsyncStorage mock with a controllable backing store (jest.setup.js also
// mocks it, but we want per-test control over getItem to simulate corruption).
const asyncStore: Record<string, string> = {};
const mockGetItem = jest.fn((k: string) => Promise.resolve(k in asyncStore ? asyncStore[k] : null));
const mockSetItem = jest.fn((k: string, v: string) => {
  asyncStore[k] = v;
  return Promise.resolve();
});
const mockRemoveItem = jest.fn((k: string) => {
  delete asyncStore[k];
  return Promise.resolve();
});
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (k: string) => mockGetItem(k),
    setItem: (k: string, v: string) => mockSetItem(k, v),
    removeItem: (k: string) => mockRemoveItem(k),
  },
}));

import { KidSessionProvider, useKidSession } from './kidSession';
import type { KidAuthResult } from '@lootloop/client';

const STORAGE_KEY = 'lootloop.kidSession.v1';

const PROFILE: KidAuthResult['profile'] = {
  id: 'k1',
  family_id: 'f1',
  display_name: 'Ada',
  avatar_url: null,
  age_mode: 'detailed',
};

const authResult = (overrides: Partial<KidAuthResult> = {}): KidAuthResult => ({
  access_token: 'tok-abc',
  token_type: 'bearer',
  expires_in: 3600,
  profile: PROFILE,
  ...overrides,
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <KidSessionProvider>{children}</KidSessionProvider>
);

const renderKidSession = () => renderHook(() => useKidSession(), { wrapper });

beforeEach(() => {
  for (const k of Object.keys(asyncStore)) delete asyncStore[k];
  mockGetItem.mockClear();
  mockSetItem.mockClear();
  mockRemoveItem.mockClear();
  mockCreateKidClient.mockClear();
});

describe('useKidSession outside a provider', () => {
  it('throws a helpful error', () => {
    // Silence the expected React error boundary noise.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useKidSession())).toThrow(
      'useKidSession must be used within a KidSessionProvider',
    );
    spy.mockRestore();
  });
});

describe('KidSessionProvider rehydration', () => {
  it('settles to signedOut with no client when storage is empty', async () => {
    const { result } = renderKidSession();
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.profile).toBeNull();
    expect(result.current.client).toBeNull();
    expect(mockCreateKidClient).not.toHaveBeenCalled();
  });

  it('restores a valid, unexpired persisted session', async () => {
    asyncStore[STORAGE_KEY] = JSON.stringify({
      access_token: 'tok-stored',
      profile: PROFILE,
      expiresAt: Date.now() + 60_000,
    });
    const { result } = renderKidSession();
    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    expect(result.current.profile).toEqual(PROFILE);
    expect(mockCreateKidClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'tok-stored',
    );
    expect(result.current.client).not.toBeNull();
    // A valid restore must not wipe storage.
    expect(mockRemoveItem).not.toHaveBeenCalled();
  });

  it('drops an expired persisted session and clears storage', async () => {
    asyncStore[STORAGE_KEY] = JSON.stringify({
      access_token: 'tok-old',
      profile: PROFILE,
      expiresAt: Date.now() - 1, // already past
    });
    const { result } = renderKidSession();
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(mockRemoveItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(result.current.client).toBeNull();
    expect(mockCreateKidClient).not.toHaveBeenCalled();
  });

  it('treats a token-less stored record as expired/invalid and clears it', async () => {
    asyncStore[STORAGE_KEY] = JSON.stringify({
      access_token: '',
      profile: PROFILE,
      expiresAt: Date.now() + 60_000,
    });
    const { result } = renderKidSession();
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(mockRemoveItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('falls back to signedOut on corrupt (unparseable) storage', async () => {
    asyncStore[STORAGE_KEY] = '{not valid json';
    const { result } = renderKidSession();
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.client).toBeNull();
  });
});

describe('signIn / signOut', () => {
  it('signIn persists the session, builds a client, and flips to signedIn', async () => {
    const { result } = renderKidSession();
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(async () => {
      await result.current.signIn(authResult({ access_token: 'tok-new', expires_in: 3600 }));
    });

    expect(result.current.status).toBe('signedIn');
    expect(result.current.profile).toEqual(PROFILE);
    expect(mockCreateKidClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'tok-new',
    );

    // Persisted blob carries the token, profile, and an absolute expiry deadline.
    expect(mockSetItem).toHaveBeenCalledWith(STORAGE_KEY, expect.any(String));
    const persisted = JSON.parse(asyncStore[STORAGE_KEY]);
    expect(persisted.access_token).toBe('tok-new');
    expect(persisted.profile).toEqual(PROFILE);
    expect(persisted.expiresAt).toBeGreaterThan(Date.now());
  });

  it('derives expiresAt from expires_in (seconds → epoch ms)', async () => {
    const { result } = renderKidSession();
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    const before = Date.now();
    await act(async () => {
      await result.current.signIn(authResult({ expires_in: 100 }));
    });
    const persisted = JSON.parse(asyncStore[STORAGE_KEY]);
    // 100s window: deadline lands ~100_000ms out, comfortably within bounds.
    expect(persisted.expiresAt).toBeGreaterThanOrEqual(before + 100_000);
    expect(persisted.expiresAt).toBeLessThanOrEqual(Date.now() + 100_000);
  });

  it('signOut clears storage and returns to signedOut', async () => {
    const { result } = renderKidSession();
    await waitFor(() => expect(result.current.status).toBe('signedOut'));

    await act(async () => {
      await result.current.signIn(authResult());
    });
    expect(result.current.status).toBe('signedIn');

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.status).toBe('signedOut');
    expect(result.current.profile).toBeNull();
    expect(result.current.client).toBeNull();
    expect(mockRemoveItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(asyncStore[STORAGE_KEY]).toBeUndefined();
  });
});
