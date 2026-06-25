import * as Sentry from '@sentry/react-native';
import { SENTRY_DSN } from '../config/env';

// Mobile error/crash monitoring (task #61). No-op when SENTRY_DSN is empty — it
// is in dev/Maestro (.env has no DSN), so only RELEASE builds (.env.production)
// report. COPPA: the mobile app has kid users, so we send ZERO PII and scrub any
// user-identifying fields before an event leaves the device. See
// docs/compliance/coppa-kids-data-review.md.
export function initSentry() {
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: 'production',
    // Don't auto-attach IP address or device/user identifiers.
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    // Defense-in-depth: strip anything that could carry kid/parent PII. We never
    // call Sentry.setUser, but scrub regardless so a future change can't leak.
    beforeSend(event) {
      delete event.user;
      if (event.contexts?.device) delete event.contexts.device.name;
      if (event.request) delete event.request.cookies;
      return event;
    },
    // Console breadcrumbs can capture typed text (PINs, names) — drop them.
    beforeBreadcrumb(breadcrumb) {
      return breadcrumb.category === 'console' ? null : breadcrumb;
    },
  });
}
