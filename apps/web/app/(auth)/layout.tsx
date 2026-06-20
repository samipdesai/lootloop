import type { ReactNode } from 'react';

// Minimal centered shell for all auth screens (spec §7, §9). No dashboard chrome.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface-page px-5 py-10">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-6">{children}</div>
    </main>
  );
}
