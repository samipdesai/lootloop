'use client';

import { useEffect, useRef, useState } from 'react';
import { createKid, updateKid, type AgeMode, type KidProfile } from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Modal } from './Modal';
import { AGE_MODES, ageModeLabel } from './ageMode';
import { NAME_MAX, validateDisplayName, validatePin } from './validation';

interface KidFormProps {
  // null = create; a kid = edit that kid.
  kid: KidProfile | null;
  onClose: () => void;
  // Called after a successful create/edit so the list can refetch.
  onSaved: () => void;
}

export function KidForm({ kid, onClose, onSaved }: KidFormProps) {
  const isEdit = Boolean(kid);

  const [displayName, setDisplayName] = useState(kid?.display_name ?? '');
  const [pin, setPin] = useState('');
  const [ageMode, setAgeMode] = useState<AgeMode>(kid?.age_mode ?? 'detailed');
  const [birthdate, setBirthdate] = useState('');

  const [fieldErrors, setFieldErrors] = useState<{ name?: string; pin?: string }>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  function validate(): boolean {
    const errs: { name?: string; pin?: string } = {};
    const nameErr = validateDisplayName(displayName);
    if (nameErr) errs.name = nameErr;
    // PIN is required on create; on edit it's changed via the separate flow.
    if (!isEdit) {
      const pinErr = validatePin(pin);
      if (pinErr) errs.pin = pinErr;
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;

    setSubmitting(true);
    const supabase = createClient();
    const name = displayName.trim();
    const bday = birthdate || null;

    if (isEdit && kid) {
      const { error } = await updateKid(supabase, kid.id, {
        display_name: name,
        age_mode: ageMode,
        birthdate: bday,
      });
      if (error) {
        setFormError(error.message ?? 'Could not save changes. Please try again.');
        setSubmitting(false);
        return;
      }
      onSaved();
      return;
    }

    const { error } = await createKid(supabase, {
      display_name: name,
      pin,
      age_mode: ageMode,
      birthdate: bday,
    });
    if (error) {
      setFormError(error.message ?? 'Could not add the kid. Please try again.');
      setSubmitting(false);
      return;
    }
    onSaved();
  }

  return (
    <Modal title={isEdit ? 'Edit kid' : 'Add kid'} onClose={onClose} busy={submitting}>
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
          <Input
            ref={nameRef}
            label="Name"
            placeholder="e.g. Riley"
            maxLength={NAME_MAX}
            value={displayName}
            disabled={submitting}
            error={fieldErrors.name}
            onChange={e => setDisplayName(e.target.value)}
          />

          {!isEdit && (
            <Input
              label="PIN"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="4–10 digits"
              hint="Your kid types this to sign in on their device."
              maxLength={10}
              value={pin}
              disabled={submitting}
              error={fieldErrors.pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            />
          )}

          <div className="flex flex-col gap-2">
            <span className="font-sans text-sm font-bold text-ink-900">Age mode</span>
            <SegmentedTabs
              tabs={AGE_MODES.map(m => ({ value: m.value, label: m.label }))}
              value={ageMode}
              onChange={v => setAgeMode(v as AgeMode)}
            />
            <span className="font-sans text-[13px] font-semibold text-ink-500">
              {ageModeLabel(ageMode)} — tailors the kid app to this age band.
            </span>
          </div>

          <Input
            label="Birthdate (optional)"
            type="date"
            value={birthdate}
            disabled={submitting}
            onChange={e => setBirthdate(e.target.value)}
          />

          {formError && <ErrorBanner>{formError}</ErrorBanner>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" loading={submitting}>
            {isEdit ? 'Save changes' : 'Add kid'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
