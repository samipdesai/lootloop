import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Dev-only: allow the Next dev server's /_next resources to load when the app
  // is opened on 127.0.0.1 (the host the Playwright E2E suite uses, chosen so the
  // signup confirmation link's redirect_to matches Supabase's site_url). Ignored
  // by `next build` / `next start`, so it has no effect on production.
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
