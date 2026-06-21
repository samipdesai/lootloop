module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // NativeWind v5 dropped its babel JSX transform (it uses Metro import
  // rewrites instead). Reanimated 4's worklets plugin must be listed LAST.
  plugins: ['react-native-worklets/plugin'],
};
