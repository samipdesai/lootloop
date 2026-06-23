import type { ReactNode } from 'react';

// Minimal public shell for marketing + legal pages (M7 #55, #53). No dashboard
// chrome, no auth — these routes are allowlisted in middleware.ts so they
// render for logged-out visitors.
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-surface-page">{children}</div>;
}
