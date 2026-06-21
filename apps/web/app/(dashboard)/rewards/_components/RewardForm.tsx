'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createReward,
  updateReward,
  getMyParentProfile,
  type Reward,
  type RewardInsert,
  type RewardUpdate,
} from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

const TITLE_MAX = 120;

interface RewardFormProps {
  // When editing, the reward to prefill; null for create.
  reward?: Reward | null;
  onClose: () => void;
  // Called with the created/updated reward so the list can refresh in place.
  onSaved: (reward: Reward) => void;
}

// Add/Edit reward modal (task #22). Mirrors ChoreForm's modal shell, focus
// management, Escape-to-close, and validation. Fields: title (required 1–120),
// cost (integer ≥ 0), emoji (optional), active toggle (edit only). On create,
// family_id is resolved from the parent profile.
export function RewardForm({ reward, onClose, onSaved }: RewardFormProps) {
  const isEdit = Boolean(reward);

  const [title, setTitle] = useState(reward?.title ?? '');
  const [cost, setCost] = useState(String(reward?.cost ?? 0));
  const [emoji, setEmoji] = useState(reward?.emoji ?? '');
  const [active, setActive] = useState(reward?.active ?? true);

  const [fieldErrors, setFieldErrors] = useState<{ title?: string; cost?: string }>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, submitting]);

  function validate(): boolean {
    const errs: typeof fieldErrors = {};
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 1) errs.title = 'Give the reward a name.';
    else if (trimmedTitle.length > TITLE_MAX) errs.title = `Keep it under ${TITLE_MAX} characters.`;

    const costNum = Number(cost);
    if (!Number.isInteger(costNum) || costNum < 0) {
      errs.cost = 'Cost must be a whole number of 0 or more.';
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
    const trimmedEmoji = emoji.trim();

    if (isEdit && reward) {
      const patch: RewardUpdate = {
        title: title.trim(),
        cost: Number(cost),
        emoji: trimmedEmoji || null,
        active,
      };
      const { data, error } = await updateReward(supabase, reward.id, patch);
      if (error || !data) {
        setFormError(error?.message ?? 'Could not save the reward. Please try again.');
        setSubmitting(false);
        return;
      }
      onSaved(data);
      return;
    }

    // Create: resolve family_id from the parent profile.
    const { data: profile, error: profileErr } = await getMyParentProfile(supabase);
    if (profileErr || !profile) {
      setFormError('Could not load your family. Please reload and try again.');
      setSubmitting(false);
      return;
    }

    const input: RewardInsert = {
      family_id: profile.family_id,
      title: title.trim(),
      cost: Number(cost),
      emoji: trimmedEmoji || null,
      active: true,
    };
    const { data, error } = await createReward(supabase, input);
    if (error || !data) {
      setFormError(error?.message ?? 'Could not create the reward. Please try again.');
      setSubmitting(false);
      return;
    }
    onSaved(data);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={e => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reward-form-title"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-card bg-surface-card shadow-[0_20px_50px_rgba(32,36,58,0.25)] sm:rounded-card"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2
            id="reward-form-title"
            className="font-display text-[22px] font-extrabold leading-tight text-ink-900"
          >
            {isEdit ? 'Edit reward' : 'Add reward'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-pill text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 disabled:opacity-50"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
            <Input
              ref={titleRef}
              label="Title"
              placeholder="e.g. Extra screen time"
              maxLength={TITLE_MAX}
              value={title}
              disabled={submitting}
              error={fieldErrors.title}
              onChange={e => setTitle(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Cost"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                placeholder="0"
                hint="In points."
                value={cost}
                disabled={submitting}
                error={fieldErrors.cost}
                onChange={e => setCost(e.target.value)}
              />
              <Input
                label="Emoji (optional)"
                placeholder="🎁"
                maxLength={8}
                hint="Shown on the reward tile."
                value={emoji}
                disabled={submitting}
                onChange={e => setEmoji(e.target.value)}
              />
            </div>

            {/* Active toggle — edit only (new rewards start active) */}
            {isEdit && (
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={active}
                  disabled={submitting}
                  onChange={e => setActive(e.target.checked)}
                  className="h-5 w-5 accent-indigo-strong"
                />
                <span className="font-sans text-sm font-bold text-ink-900">
                  Active
                  <span className="ml-1 font-semibold text-ink-500">
                    (inactive rewards are hidden from the kid store)
                  </span>
                </span>
              </label>
            )}

            {formError && <ErrorBanner>{formError}</ErrorBanner>}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
            <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" loading={submitting}>
              {isEdit ? 'Save changes' : 'Create reward'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
