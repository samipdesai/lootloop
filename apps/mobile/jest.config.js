module.exports = {
  preset: '@react-native/jest-preset',
  // pnpm stores deps under node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>,
  // so the RN preset's default transformIgnorePatterns (which expects a flat
  // node_modules/<pkg> layout) fails to transform RN packages that ship ESM
  // (e.g. @react-native/js-polyfills). Allow the optional .pnpm path segment.
  transformIgnorePatterns: [
    'node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?(?:jest-)?(?:@react-native|react-native|react-native-safe-area-context)/)',
  ],
};
