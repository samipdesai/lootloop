'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createChore,
  updateChore,
  getMyParentProfile,
  type Chore,
  type ChoreInsert,
  type ChoreUpdate,
  type KidProfile,
} from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import {
  WEEKDAYS,
  buildRecurrenceRule,
  parseRecurrenceRule,
  type RecurrenceKind,
  type Weekday,
} from './recurrence';

const TITLE_MAX = 120;

interface ChoreFormProps {
  kids: KidProfile[];
  // When editing, the chore to prefill; null/undefined for create.
  chore?: Chore | null;
  onClose: () => void;
  // Called with the created/updated chore so the list can refresh in place.
  onSaved: (chore: Chore) => void;
}

export function ChoreForm({ kids, chore, onClose, onSaved }: ChoreFormProps) {
  const isEdit = Boolean(chore);
  const initialRecurrence = parseRecurrenceRule(chore?.recurrence_rule ?? null);

  const [title, setTitle] = useState(chore?.title ?? '');
  const [icon, setIcon] = useState(chore?.icon ?? '');
  const [points, setPoints] = useState(String(chore?.points ?? 0));
  const [assignment, setAssignment] = useState<'assigned' | 'shared'>(
    chore?.assignment ?? 'shared',
  );
  const [assignedKidId, setAssignedKidId] = useState<string>(chore?.assigned_kid_id ?? '');
  const [recurKind, setRecurKind] = useState<RecurrenceKind>(initialRecurrence.kind);
  const [recurDays, setRecurDays] = useState<Weekday[]>(initialRecurrence.days);
  const [active, setActive] = useState(chore?.active ?? true);

  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    points?: string;
    assignedKid?: string;
    recurrence?: string;
  }>({});
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

  function toggleDay(code: Weekday) {
    setRecurDays(prev => (prev.includes(code) ? prev.filter(d => d !== code) : [...prev, code]));
  }

  function validate(): boolean {
    const errs: typeof fieldErrors = {};
    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 1) errs.title = 'Give the chore a name.';
    else if (trimmedTitle.length > TITLE_MAX) errs.title = `Keep it under ${TITLE_MAX} characters.`;

    const pointsNum = Number(points);
    if (!Number.isInteger(pointsNum) || pointsNum < 0) {
      errs.points = 'Points must be a whole number of 0 or more.';
    }

    if (assignment === 'assigned' && !assignedKidId) {
      errs.assignedKid = 'Pick a kid to assign this to.';
    }

    if (recurKind === 'weekly' && recurDays.length === 0) {
      errs.recurrence = 'Pick at least one day.';
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

    const recurrenceRule = buildRecurrenceRule({ kind: recurKind, days: recurDays });
    // Enforce the DB CHECK constraint: assigned ⇒ kid set; shared ⇒ kid null.
    const resolvedKidId = assignment === 'assigned' ? assignedKidId : null;
    const trimmedIcon = icon.trim();

    if (isEdit && chore) {
      const patch: ChoreUpdate = {
        title: title.trim(),
        icon: trimmedIcon || null,
        points: Number(points),
        assignment,
        assigned_kid_id: resolvedKidId,
        recurrence_rule: recurrenceRule,
        active,
      };
      const { data, error } = await updateChore(supabase, chore.id, patch);
      if (error || !data) {
        setFormError(error?.message ?? 'Could not save the chore. Please try again.');
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

    const input: ChoreInsert = {
      family_id: profile.family_id,
      title: title.trim(),
      icon: trimmedIcon || null,
      points: Number(points),
      assignment,
      assigned_kid_id: resolvedKidId,
      recurrence_rule: recurrenceRule,
      active: true,
    };
    const { data, error } = await createChore(supabase, input);
    if (error || !data) {
      setFormError(error?.message ?? 'Could not create the chore. Please try again.');
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
        aria-labelledby="chore-form-title"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-card bg-surface-card shadow-[0_20px_50px_rgba(32,36,58,0.25)] sm:rounded-card"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2
            id="chore-form-title"
            className="font-display text-[22px] font-extrabold leading-tight text-ink-900"
          >
            {isEdit ? 'Edit chore' : 'Add chore'}
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
              placeholder="e.g. Make your bed"
              maxLength={TITLE_MAX}
              value={title}
              disabled={submitting}
              error={fieldErrors.title}
              onChange={e => setTitle(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Points"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                placeholder="0"
                value={points}
                disabled={submitting}
                error={fieldErrors.points}
                onChange={e => setPoints(e.target.value)}
              />
              <Input
                label="Icon (optional)"
                placeholder="e.g. broom"
                autoCapitalize="none"
                autoCorrect="off"
                hint="A lucide icon name."
                value={icon}
                disabled={submitting}
                onChange={e => setIcon(e.target.value)}
              />
            </div>

            {/* Assignment */}
            <div className="flex flex-col gap-2">
              <span className="font-sans text-sm font-bold text-ink-900">Assignment</span>
              <SegmentedTabs
                tabs={[
                  { value: 'shared', label: 'Shared (claimable)' },
                  { value: 'assigned', label: 'Assigned to a kid' },
                ]}
                value={assignment}
                onChange={v => setAssignment(v as 'assigned' | 'shared')}
              />
              {assignment === 'assigned' && (
                <div className="flex flex-col gap-1.5 pt-1">
                  {kids.length === 0 ? (
                    <p className="font-sans text-[13px] font-semibold text-ink-500">
                      No kids in your family yet — add a kid first, or use a shared chore.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {kids.map(kid => {
                        const selected = assignedKidId === kid.id;
                        return (
                          <button
                            key={kid.id}
                            type="button"
                            aria-pressed={selected}
                            disabled={submitting}
                            onClick={() => setAssignedKidId(kid.id)}
                            className={`rounded-pill border px-3.5 py-1.5 font-display text-sm font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-strong ${
                              selected
                                ? 'border-indigo bg-indigo-soft text-indigo-ink'
                                : 'border-border bg-surface-card text-ink-700 hover:border-border-strong'
                            }`}
                          >
                            {kid.display_name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {fieldErrors.assignedKid && (
                    <span className="font-sans text-[13px] font-semibold text-danger-ink">
                      {fieldErrors.assignedKid}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Recurrence */}
            <div className="flex flex-col gap-2">
              <span className="font-sans text-sm font-bold text-ink-900">Repeats</span>
              <SegmentedTabs
                tabs={[
                  { value: 'none', label: 'Does not repeat' },
                  { value: 'daily', label: 'Every day' },
                  { value: 'weekly', label: 'Weekly on…' },
                ]}
                value={recurKind}
                onChange={v => setRecurKind(v as RecurrenceKind)}
              />
              {recurKind === 'weekly' && (
                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map(day => {
                      const selected = recurDays.includes(day.code);
                      return (
                        <button
                          key={day.code}
                          type="button"
                          aria-pressed={selected}
                          aria-label={day.long}
                          disabled={submitting}
                          onClick={() => toggleDay(day.code)}
                          className={`h-10 w-12 rounded-md border font-display text-sm font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-strong ${
                            selected
                              ? 'border-indigo bg-indigo-soft text-indigo-ink'
                              : 'border-border bg-surface-card text-ink-700 hover:border-border-strong'
                          }`}
                        >
                          {day.short}
                        </button>
                      );
                    })}
                  </div>
                  {fieldErrors.recurrence && (
                    <span className="font-sans text-[13px] font-semibold text-danger-ink">
                      {fieldErrors.recurrence}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Active toggle — edit only (new chores start active) */}
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
                    (inactive chores stop generating to-dos)
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
              {isEdit ? 'Save changes' : 'Create chore'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
