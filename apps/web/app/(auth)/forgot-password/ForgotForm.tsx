'use client';

import { useState } from 'react';
import Link from 'next/link';
import { requestPasswordReset, mapAuthError } from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { validateEmail } from '@/lib/auth/validation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

export function ForgotForm() {
  const [email, setEmail] = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const canSubmit = !validateEmail(email) && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const eErr = validateEmail(email);
    setEmailErr(eErr);
    setTouched(true);
    if (eErr) return;

    setSubmitting(true);
    setFormError('');
    const supabase = createClient();
    const trimmed = email.trim();
    // redirectTo lands on the callback, which establishes a recovery session
    // then routes to /reset-password.
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
    const { error } = await requestPasswordReset(supabase, trimmed, redirectTo);
    setSubmitting(false);
    // Privacy-preserving: only true failures (network/rate-limit) show an error;
    // "no such user" still shows the neutral success panel (spec §5.5).
    if (error && (error.status === 429 || !error.status)) {
      setFormError(mapAuthError(error));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[26px] font-extrabold leading-tight text-ink-900">
            Check your email
          </h1>
          <p className="font-sans text-base font-semibold text-ink-500">
            If an account exists for <span className="text-ink-900">{email.trim()}</span>,
            we&apos;ve sent a password reset link.
          </p>
        </div>
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

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[26px] font-extrabold leading-tight text-ink-900">
          Reset your password
        </h1>
        <p className="font-sans text-base font-semibold text-ink-500">
          Enter your email and we&apos;ll send a reset link.
        </p>
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="you@example.com"
          value={email}
          disabled={submitting}
          error={touched ? emailErr : ''}
          onChange={e => {
            setEmail(e.target.value);
            if (touched) setEmailErr(validateEmail(e.target.value));
          }}
          onBlur={() => {
            setTouched(true);
            setEmailErr(validateEmail(email));
          }}
        />

        {formError && <ErrorBanner>{formError}</ErrorBanner>}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          block
          disabled={!canSubmit}
          loading={submitting}
        >
          Send reset link
        </Button>

        <p className="text-center">
          <Link
            href="/login"
            className="font-sans text-sm font-bold text-indigo-strong hover:underline"
          >
            Back to log in
          </Link>
        </p>
      </form>
    </div>
  );
}
