'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';

// Signs the parent out, then routes to /login (task #10). Mirrors the logout
// pattern already used in OnboardingForm.
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    await signOut(supabase);
    router.replace('/login');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className="inline-flex h-10 items-center gap-2 rounded-pill border border-border bg-surface-card px-4 font-display text-[13px] font-bold text-ink-700 shadow-sm transition-colors hover:bg-ink-50 disabled:cursor-wait disabled:opacity-60"
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
      {busy ? 'Logging out…' : 'Log out'}
    </button>
  );
}
