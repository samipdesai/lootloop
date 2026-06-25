// Client-side (browser) Sentry init (Next.js App Router, task #61). No-op
// without NEXT_PUBLIC_SENTRY_DSN, so local dev never reports.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'production',
    tracesSampleRate: 0.1,
    // Session Replay records screen content — keep it off (privacy + free tier).
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
  });
}

// Instruments App Router client navigations.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
