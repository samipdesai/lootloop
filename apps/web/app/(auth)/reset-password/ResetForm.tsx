'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { updatePassword, mapAuthError } from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { validatePasswordStrength } from '@/lib/auth/validation';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

type Phase = 'checking' | 'invalid' | 'form' | 'done';

export function ResetForm() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [password, setPassword] = useState('');
  const [passwordErr, setPasswordErr] = useState('');
  const [touched, setTouched] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // On mount, require a recovery session (established by the emailed link via the
  // callback). No session → invalid/expired link panel (spec §5.6).
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setPhase(data.session ? 'form' : 'invalid');
    });
  }, []);

  const canSubmit = !validatePasswordStrength(password) && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pErr = validatePasswordStrength(password);
    setPasswordErr(pErr);
    setTouched(true);
    if (pErr) return;

    setSubmitting(true);
    setFormError('');
    const supabase = createClient();
    const { error } = await updatePassword(supabase, password);
    if (error) {
      setFormError(mapAuthError(error) || "Couldn't update your password. Try again.");
      setSubmitting(false);
      return;
    }
    // Recovery session is not treated as a full login; sign out, re-auth at login.
    await supabase.auth.signOut();
    setPhase('done');
  }

  if (phase === 'checking') {
    return <div className="h-40" aria-hidden />;
  }

  if (phase === 'invalid') {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[26px] font-extrabold leading-tight text-ink-900">
            Link expired
          </h1>
          <p className="font-sans text-base font-semibold text-ink-500">
            This reset link is invalid or expired.
          </p>
        </div>
        <p className="text-center">
          <Link
            href="/forgot-password"
            className="font-sans text-sm font-bold text-indigo-strong hover:underline"
          >
            Request a new link
          </Link>
        </p>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[26px] font-extrabold leading-tight text-ink-900">
            Password updated 🎉
          </h1>
          <p className="font-sans text-base font-semibold text-ink-500">
            Log in with your new password.
          </p>
        </div>
        <Link href="/login" className="w-full">
          <Button variant="primary" size="lg" block>
            Go to log in
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[26px] font-extrabold leading-tight text-ink-900">
          Set a new password
        </h1>
        <p className="font-sans text-base font-semibold text-ink-500">
          Choose a new password for your account.
        </p>
      </div>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <PasswordInput
          label="New password"
          autoComplete="new-password"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="New password"
          hint="At least 8 characters."
          value={password}
          disabled={submitting}
          error={touched ? passwordErr : ''}
          onChange={e => {
            setPassword(e.target.value);
            if (touched) setPasswordErr(validatePasswordStrength(e.target.value));
          }}
          onBlur={() => {
            setTouched(true);
            setPasswordErr(validatePasswordStrength(password));
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
          Save new password
        </Button>
      </form>
    </div>
  );
}
