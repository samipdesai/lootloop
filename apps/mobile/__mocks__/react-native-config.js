// react-native-config is a native module; under Jest there is no native layer,
// so provide a manual mock (auto-applied for node_modules). Env-dependent code
// paths see undefined values and skip native/network work in tests.
module.exports = {
  __esModule: true,
  default: {
    SUPABASE_URL: undefined,
    SUPABASE_ANON_KEY: undefined,
  },
};
