const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withSentryConfig } = require('@sentry/react-native/metro');
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

// withSentryConfig adds the Debug ID + source-map plumbing Sentry needs to
// symbolicate release crashes (task #61). Harmless in dev.
module.exports = withSentryConfig(mergeConfig(getDefaultConfig(projectRoot), config));
