'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { mapAuthError } from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

const COOLDOWN = 30;

export function ConfirmClient() {
  const params = useSearchParams();
  const email = params.get('email') ?? '';

  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function resend() {
    if (!email || sending || cooldown > 0) return;
    setSending(true);
    setError('');
    setSent(false);
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email });
    setSending(false);
    if (resendError) {
      setError(mapAuthError(resendError));
      return;
    }
    setSent(true);
    setCooldown(COOLDOWN);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[26px] font-extrabold leading-tight text-ink-900">
          Check your email
        </h1>
        <p className="font-sans text-base font-semibold text-ink-500">
          We sent a confirmation link to{' '}
          <span className="text-ink-900">{email || 'your inbox'}</span>. Click it to finish setting
          up your account.
        </p>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}
      {sent && !error && (
        <p role="status" className="font-sans text-sm font-bold text-mint-strong">
          Sent!
        </p>
      )}

      <Button
        type="button"
        variant="ghost"
        size="lg"
        block
        onClick={resend}
        disabled={!email || sending || cooldown > 0}
        loading={sending}
      >
        {cooldown > 0 ? `Resend in ${cooldown}s…` : 'Resend email'}
      </Button>

      <p className="text-center">
        <Link
          href="/login"
          className="font-sans text-sm font-bold text-indigo-strong hover:underline"
        >
          Back to log in
        </Link>
      </p>
    </div>
  );
}
