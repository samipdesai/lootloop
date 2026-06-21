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
// resolves to defined strings.
jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_ANON_KEY: 'test-anon-key',
  },
}));
