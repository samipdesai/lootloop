import type { ReactNode } from 'react';

// Bare pass-through so the login screen can be a full-bleed two-panel layout.
// Every other auth screen wraps its own content in <AuthCentered> (the old
// centered 420px shell). No dashboard chrome.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-surface-page">{children}</div>;
}
