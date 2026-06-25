// Server-side Sentry init (Next.js App Router, task #61). Runs in the Node and
// Edge runtimes via Next's `register()` hook. Sentry is a no-op when
// NEXT_PUBLIC_SENTRY_DSN is unset (local dev), so it only reports from prod.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function register() {
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'production',
    // Light tracing — enough to spot slow routes without burning the free tier.
    tracesSampleRate: 0.1,
    // Never attach IP / cookies / headers. Web is parent-only, but keep it strict.
    sendDefaultPii: false,
  });
}

// Captures errors thrown in Server Components, route handlers, and middleware.
export const onRequestError = Sentry.captureRequestError;
