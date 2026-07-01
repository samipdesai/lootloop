'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock } from 'lucide-react';
import { signInParent, mapAuthError } from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { validateEmail, validatePasswordPresent } from '@/lib/auth/validation';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [passwordErr, setPasswordErr] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = !validateEmail(email) && !validatePasswordPresent(password) && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const eErr = validateEmail(email);
    const pErr = validatePasswordPresent(password);
    setEmailErr(eErr);
    setPasswordErr(pErr);
    setTouched({ email: true, password: true });
    if (eErr || pErr) return;

    setSubmitting(true);
    setFormError('');
    const supabase = createClient();
    const { error } = await signInParent(supabase, email.trim(), password);
    if (error) {
      setFormError(mapAuthError(error));
      setSubmitting(false);
      return;
    }
    // Middleware routes by profile state (onboarding vs dashboard); refresh to it.
    router.replace('/');
    router.refresh();
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
        iconLeft={<Mail size={19} />}
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

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="login-password" className="font-sans text-sm font-bold text-ink-900">
            Password
          </label>
          <Link
            href="/forgot-password"
            className="font-sans text-[13px] font-bold text-indigo-strong hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="login-password"
          aria-label="Password"
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="Your password"
          iconLeft={<Lock size={19} />}
          value={password}
          disabled={submitting}
          error={touched.password ? passwordErr : ''}
          onChange={e => {
            setPassword(e.target.value);
            if (touched.password) setPasswordErr(validatePasswordPresent(e.target.value));
          }}
          onBlur={() => {
            setTouched(t => ({ ...t, password: true }));
            setPasswordErr(validatePasswordPresent(password));
          }}
        />
      </div>

      {formError && <ErrorBanner>{formError}</ErrorBanner>}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        block
        disabled={!canSubmit}
        loading={submitting}
      >
        Log in
      </Button>
    </form>
  );
}
