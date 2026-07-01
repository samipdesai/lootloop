import type { ReactNode } from 'react';

// Centered 420px card shell used by every auth screen EXCEPT login (which is a
// full-bleed two-panel layout). The (auth) layout is a bare pass-through so login
// can span the viewport; the other pages opt into this centered container.
export function AuthCentered({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface-page px-5 py-10">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-6">{children}</div>
    </main>
  );
}
