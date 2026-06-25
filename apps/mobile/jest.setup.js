/* eslint-env jest, node */
// Jest setup: mock native modules that ship ESM / need a native bridge, so
// stores and screens importing them can be smoke-tested under Jest. Added when
// the kid session store (#9-client) pulled AsyncStorage + react-native-config
// into the App render path. Registered via `setupFiles` in jest.config.js.

// AsyncStorage — in-memory mock (the kid session store persists its token here).
jest.mock('@react-native-async-storage/async-storage', () => {
  let store = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k) => Promise.resolve(k in store ? store[k] : null)),
      setItem: jest.fn((k, v) => {
        store[k] = v;
        return Promise.resolve();
      }),
      removeItem: jest.fn((k) => {
        delete store[k];
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        store = {};
        return Promise.resolve();
      }),
    },
  };
});

// react-native-config — build-time env shim; provide test values so config/env
// resolves to defined strings. SENTRY_DSN omitted → Sentry stays off in tests.
jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_ANON_KEY: 'test-anon-key',
  },
}));

// @sentry/react-native ships ESM (from @sentry/core) that Jest can't parse, and
// we never want real reporting under test. Mock the surface we use: wrap is the
// identity so App still renders; init is a no-op (the empty DSN above means it
// wouldn't run anyway). Mirrors the native-boundary mocks above (task #61).
jest.mock('@sentry/react-native', () => ({
  __esModule: true,
  init: jest.fn(),
  wrap: (component) => component,
}));
