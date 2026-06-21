const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withNativewind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

/**
 * Metro configuration — pnpm monorepo aware.
 * https://reactnative.dev/docs/metro
 *
 * Watch the workspace root so Metro can follow pnpm's symlinked deps into the
 * root `.pnpm` store, and resolve modules from both the app and root
 * node_modules.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
  },
};

// NativeWind v5: withNativewind no longer takes a second `{ input }` arg — the
// CSS entry is picked up from the `import './global.css'` in the app code.
module.exports = withNativewind(mergeConfig(getDefaultConfig(projectRoot), config));
