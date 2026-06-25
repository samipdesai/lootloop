import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  // Dev-only: allow the Next dev server's /_next resources to load when the app
  // is opened on 127.0.0.1 (the host the Playwright E2E suite uses, chosen so the
  // signup confirmation link's redirect_to matches Supabase's site_url). Ignored
  // by `next build` / `next start`, so it has no effect on production.
  allowedDevOrigins: ['127.0.0.1'],
};

// Sentry (task #61). The bundler plugin only uploads source maps when an auth
// token is present (CI/prod build), so local `next build` stays a no-op. org +
// project identify where releases land.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: 'lootloop-web',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
