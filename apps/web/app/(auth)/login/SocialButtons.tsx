// Social sign-in — DISABLED / "coming soon". OAuth (Google/Apple) is deferred to
// Phase 2 (not wired to Supabase yet), so these render for layout parity but are
// non-interactive. Replace `disabled` + wire onClick when OAuth lands.

function GoogleMark() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7C21.8 18.9 23 15.9 23 12.3z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.8H1.8v3C3.7 21.3 7.5 24 12 24z"
      />
      <path fill="#FBBC05" d="M5.6 14.6a7.2 7.2 0 0 1 0-4.6v-3H1.8a12 12 0 0 0 0 10.6l3.8-3z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.2 15.1 0 12 0 7.5 0 3.7 2.7 1.8 6.4l3.8 3C6.5 6.8 9 4.8 12 4.8z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="var(--color-ink-900)" aria-hidden>
      <path d="M16.5 12.9c0-2 1.6-3 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.2 2-1.4 2.4-.4 6 1 8 .7 1 1.4 2 2.5 2 1 0 1.3-.6 2.5-.6 1.2 0 1.5.6 2.5.6 1.1 0 1.8-1 2.4-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2-.8-2-3.1zM14.6 6.2c.6-.7 1-1.6.9-2.5-.8 0-1.9.6-2.5 1.3-.5.6-1 1.5-.9 2.4.9.1 1.9-.5 2.5-1.2z" />
    </svg>
  );
}

function SocialButton({ mark, label }: { mark: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      disabled
      aria-disabled
      title="Coming soon"
      className="inline-flex h-[52px] cursor-not-allowed items-center justify-center gap-2.5 rounded-pill bg-white font-display text-[15px] font-bold text-ink-900 opacity-60 shadow-[inset_0_0_0_2px_var(--color-border)]"
    >
      {mark}
      {label}
      <span className="text-[11px] font-bold text-ink-400">(soon)</span>
    </button>
  );
}

export function SocialButtons() {
  return (
    <div className="flex flex-col gap-3">
      <SocialButton mark={<GoogleMark />} label="Continue with Google" />
      <SocialButton mark={<AppleMark />} label="Continue with Apple" />
    </div>
  );
}
