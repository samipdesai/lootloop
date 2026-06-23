'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';

// Static email-capture for the coming-soon page (M7 #55). No backend yet:
// submitting just shows a thank-you state. Wiring this to a real list/endpoint
// is intentionally out of scope (see TODO below).
export function EmailCapture() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    // TODO(#56+): POST to a real waitlist endpoint / mailing-list provider.
    // No backend is wired for the coming-soon launch — this is a no-op capture.
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p
        role="status"
        className="font-display text-base font-bold text-mint-ink"
      >
        You&apos;re on the list — we&apos;ll be in touch! 🎉
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-[440px] flex-col gap-3 sm:flex-row"
    >
      <div className="flex-1">
        <Input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
        />
      </div>
      <Button type="submit">Notify me</Button>
    </form>
  );
}
