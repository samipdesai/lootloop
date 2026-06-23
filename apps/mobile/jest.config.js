module.exports = {
  preset: '@react-native/jest-preset',
  // Mocks for native modules (AsyncStorage, react-native-config) pulled in by the
  // kid session store; see jest.setup.js.
  setupFiles: ['<rootDir>/jest.setup.js'],
  // pnpm stores deps under node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>,
  // so the RN preset's default transformIgnorePatterns (which expects a flat
  // node_modules/<pkg> layout) fails to transform RN packages that ship ESM
  // (e.g. @react-native/js-polyfills). Allow the optional .pnpm path segment.
  // nativewind + react-navigation + react-native-screens also ship ESM and must
  // be transformed.
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?(?:jest-)?(?:@react-native|react-native|react-native-safe-area-context|react-native-screens|@react-navigation|nativewind|react-native-css-interop)/)',
  ],
  moduleNameMapper: {
    // global.css is consumed by Metro+NativeWind at build time; stub it in Jest.
    '\\.css$': '<rootDir>/__mocks__/styleMock.js',
  },
  // M6 #48 coverage gate. Scoped to the unit-tested logic layer (Zustand-style
  // stores + hooks, task #44) — NOT the whole app, since screens are covered by
  // E2E (Maestro), not unit tests. A drop below 70% here fails the run.
  coverageThreshold: {
    './src/stores/': { statements: 70, branches: 70, functions: 70, lines: 70 },
    './src/hooks/': { statements: 70, branches: 70, functions: 70, lines: 70 },
  },
};
