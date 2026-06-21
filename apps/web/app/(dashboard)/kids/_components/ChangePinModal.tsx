'use client';

import { useEffect, useRef, useState } from 'react';
import { setKidPin, type KidProfile } from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Modal } from './Modal';
import { validatePin } from './validation';

interface ChangePinModalProps {
  kid: KidProfile;
  onClose: () => void;
  onSaved: () => void;
}

export function ChangePinModal({ kid, onClose, onSaved }: ChangePinModalProps) {
  const [pin, setPin] = useState('');
  const [pinErr, setPinErr] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pinRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    pinRef.current?.focus();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    const err = validatePin(pin);
    setPinErr(err);
    if (err) return;

    setSubmitting(true);
    const supabase = createClient();
    const { error } = await setKidPin(supabase, kid.id, pin);
    if (error) {
      setFormError(error.message ?? 'Could not update the PIN. Please try again.');
      setSubmitting(false);
      return;
    }
    onSaved();
  }

  return (
    <Modal title={`Change PIN — ${kid.display_name}`} onClose={onClose} busy={submitting}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col">
        <div className="flex flex-col gap-5 px-6 py-5">
          <Input
            ref={pinRef}
            label="New PIN"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="4–10 digits"
            hint="Your kid uses this to sign in on their device."
            maxLength={10}
            value={pin}
            disabled={submitting}
            error={pinErr}
            onChange={e => {
              setPin(e.target.value.replace(/\D/g, ''));
              if (pinErr) setPinErr('');
            }}
          />
          {formError && <ErrorBanner>{formError}</ErrorBanner>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" loading={submitting}>
            Save PIN
          </Button>
        </div>
      </form>
    </Modal>
  );
}
