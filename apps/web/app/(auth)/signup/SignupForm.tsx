'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signUpParent, mapAuthError } from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { validateEmail, validatePasswordStrength } from '@/lib/auth/validation';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [passwordErr, setPasswordErr] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = !validateEmail(email) && !validatePasswordStrength(password) && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const eErr = validateEmail(email);
    const pErr = validatePasswordStrength(password);
    setEmailErr(eErr);
    setPasswordErr(pErr);
    setTouched({ email: true, password: true });
    if (eErr || pErr) return;

    setSubmitting(true);
    setFormError('');
    const supabase = createClient();
    const trimmed = email.trim();
    // emailRedirectTo points at the callback that exchanges the code for a session.
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await signUpParent(supabase, trimmed, password, redirectTo);
    if (error) {
      setFormError(mapAuthError(error));
      setSubmitting(false);
      return;
    }
    // Confirmation is ON → no session. Go to Check-your-email with the address.
    router.push(`/confirm?email=${encodeURIComponent(trimmed)}`);
  }

  return (
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
        error={touched.email ? emailErr : ''}
        onChange={e => {
          setEmail(e.target.value);
          if (touched.email) setEmailErr(validateEmail(e.target.value));
        }}
        onBlur={() => {
          setTouched(t => ({ ...t, email: true }));
          setEmailErr(validateEmail(email));
        }}
      />

      <PasswordInput
        label="Password"
        autoComplete="new-password"
        autoCapitalize="none"
        autoCorrect="off"
        placeholder="Create a password"
        hint="At least 8 characters."
        value={password}
        disabled={submitting}
        error={touched.password ? passwordErr : ''}
        onChange={e => {
          setPassword(e.target.value);
          if (touched.password) setPasswordErr(validatePasswordStrength(e.target.value));
        }}
        onBlur={() => {
          setTouched(t => ({ ...t, password: true }));
          setPasswordErr(validatePasswordStrength(password));
        }}
      />

      {formError && (
        <ErrorBanner>
          {formError}
          {/already exists/i.test(formError) && (
            <>
              {' '}
              <Link href="/login" className="underline">
                Log in instead?
              </Link>
            </>
          )}
        </ErrorBanner>
      )}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        block
        disabled={!canSubmit}
        loading={submitting}
      >
        Create account
      </Button>

      {/* OAuth: Sign in with Apple — deferred, see spec §1.4 */}

      <p className="text-center font-sans text-sm font-semibold text-ink-500">
        Already have an account?{' '}
        <Link href="/login" className="font-bold text-orange-strong hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
