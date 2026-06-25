'use client';

// Root error boundary (task #61). Catches errors thrown in the root layout that
// nothing else can — it replaces the whole document, so it renders its own
// <html>/<body> with inline styles (globals.css isn't loaded here). Reports the
// error to Sentry, then offers a recovery.
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#F8F5F1',
          color: '#1f2937',
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: 420 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.5rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#6b7280', margin: '0 0 1.5rem' }}>
            We hit an unexpected error. Please try again.
          </p>
          <button
            onClick={() => reset()}
            style={{
              background: '#F0B315',
              color: '#1f2937',
              border: 'none',
              borderRadius: '0.75rem',
              padding: '0.625rem 1.5rem',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
