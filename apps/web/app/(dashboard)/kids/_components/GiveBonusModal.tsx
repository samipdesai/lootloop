'use client';

import { useEffect, useRef, useState } from 'react';
import { awardBonusPoints, type KidProfile } from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Modal } from './Modal';

interface GiveBonusModalProps {
  kid: KidProfile;
  // The signed-in parent's profile id (awardedBy on the RPC).
  awardedBy: string;
  onClose: () => void;
  // Called after a successful award with the amount granted, so the list can
  // confirm + refresh the kid's shown balance.
  onAwarded: (amount: number) => void;
}

const NOTE_MAX = 200;

// Bonus amount: positive integer (the SQL fn enforces amount > 0; we validate up
// front for friendly copy). Digits only, no leading zeros beyond a single 0.
function validateAmount(raw: string): string {
  if (raw.trim().length === 0) return 'Enter how many points to give.';
  if (!/^\d+$/.test(raw)) return 'Points must be a whole number.';
  const n = Number(raw);
  if (n <= 0) return 'Give at least 1 point.';
  return '';
}

export function GiveBonusModal({ kid, awardedBy, onClose, onAwarded }: GiveBonusModalProps) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [amountErr, setAmountErr] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const amountRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    const err = validateAmount(amount);
    setAmountErr(err);
    if (err) return;

    setSubmitting(true);
    const supabase = createClient();
    const trimmedNote = note.trim();
    const { error } = await awardBonusPoints(
      supabase,
      kid.id,
      Number(amount),
      trimmedNote || null,
      awardedBy,
    );
    if (error) {
      setFormError(error.message ?? 'Could not award the bonus. Please try again.');
      setSubmitting(false);
      return;
    }
    onAwarded(Number(amount));
  }

  return (
    <Modal title={`Give bonus — ${kid.display_name}`} onClose={onClose} busy={submitting}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col">
        <div className="flex flex-col gap-5 px-6 py-5">
          <Input
            ref={amountRef}
            label="Points"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="e.g. 25"
            hint="A one-time bonus added to their spendable balance."
            maxLength={7}
            value={amount}
            disabled={submitting}
            error={amountErr}
            suffix={
              <span className="font-display text-sm font-bold text-coin-ink" aria-hidden>
                pts
              </span>
            }
            onChange={e => {
              setAmount(e.target.value.replace(/\D/g, ''));
              if (amountErr) setAmountErr('');
            }}
          />

          <Input
            label="Note (optional)"
            placeholder="e.g. Helped a neighbor"
            maxLength={NOTE_MAX}
            value={note}
            disabled={submitting}
            onChange={e => setNote(e.target.value)}
          />

          {formError && <ErrorBanner>{formError}</ErrorBanner>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" loading={submitting}>
            Give bonus
          </Button>
        </div>
      </form>
    </Modal>
  );
}
