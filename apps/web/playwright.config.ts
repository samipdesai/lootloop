import { defineConfig, devices } from '@playwright/test';

// Greenfield Playwright E2E for the parent web dashboard (task #46). Runs the
// three parent golden paths against a LOCAL Supabase + the Next.js dev server.
//
// baseURL is 127.0.0.1 (not localhost): the signup→confirm path relies on
// `window.location.origin` matching Supabase's `site_url` (http://127.0.0.1:3000)
// so the emailed PKCE confirmation link redirects back to /auth/callback?code=…
// instead of falling back to the bare site_url.
const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // Specs seed shared DB rows keyed by a deterministic family name; keep them
  // serial so a parallel run can't delete another spec's family mid-flight.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    actionTimeout: 15_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Start (or reuse) the dev server bound to 127.0.0.1 so the host stays
  // consistent through the signup→callback redirect. Next's callback redirects
  // off `request.nextUrl.origin`, which mirrors the server's bound hostname; if
  // it flipped to `localhost` the 127.0.0.1-scoped session cookie wouldn't be
  // sent and the just-confirmed user would bounce back to /login.
  webServer: {
    command: 'next dev --hostname 127.0.0.1',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
