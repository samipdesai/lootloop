'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createScheduleItem,
  updateScheduleItem,
  getMyParentProfile,
  type ScheduleItem,
  type ScheduleItemInsert,
  type ScheduleItemUpdate,
  type KidProfile,
} from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { WEEKDAYS, canonicalDays, isEndAfterStart, toTimeInputValue, type IsoDay } from './days';

const TITLE_MAX = 120;

interface ScheduleFormProps {
  kids: KidProfile[];
  // When editing, the item to prefill; null for create.
  item?: ScheduleItem | null;
  onClose: () => void;
  // Called with the created/updated item so the list can refresh in place.
  onSaved: (item: ScheduleItem) => void;
}

export function ScheduleForm({ kids, item, onClose, onSaved }: ScheduleFormProps) {
  const isEdit = Boolean(item);

  const [kidId, setKidId] = useState<string>(item?.kid_id ?? kids[0]?.id ?? '');
  const [title, setTitle] = useState(item?.title ?? '');
  const [icon, setIcon] = useState(item?.icon ?? '');
  const [startTime, setStartTime] = useState(toTimeInputValue(item?.start_time ?? null));
  const [endTime, setEndTime] = useState(toTimeInputValue(item?.end_time ?? null));
  const [days, setDays] = useState<IsoDay[]>(canonicalDays(item?.days_of_week ?? []));
  const [active, setActive] = useState(item?.active ?? true);

  const [fieldErrors, setFieldErrors] = useState<{
    kid?: string;
    title?: string;
    startTime?: string;
    endTime?: string;
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

  function toggleDay(code: IsoDay) {
    setDays(prev =>
      prev.includes(code) ? prev.filter(d => d !== code) : canonicalDays([...prev, code]),
    );
  }

  function validate(): boolean {
    const errs: typeof fieldErrors = {};
    if (!kidId) errs.kid = 'Pick a kid for this item.';

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 1) errs.title = 'Give the item a name.';
    else if (trimmedTitle.length > TITLE_MAX) errs.title = `Keep it under ${TITLE_MAX} characters.`;

    if (!startTime) errs.startTime = 'Pick a start time.';

    if (endTime && startTime && !isEndAfterStart(startTime, endTime)) {
      errs.endTime = 'End time must be after the start time.';
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

    const trimmedIcon = icon.trim();
    // None selected = every day → submit []. Otherwise canonical Monday-first.
    const daysOfWeek = canonicalDays(days);

    if (isEdit && item) {
      const patch: ScheduleItemUpdate = {
        kid_id: kidId,
        title: title.trim(),
        icon: trimmedIcon || null,
        start_time: startTime,
        end_time: endTime || null,
        days_of_week: daysOfWeek,
        active,
      };
      const { data, error } = await updateScheduleItem(supabase, item.id, patch);
      if (error || !data) {
        setFormError(error?.message ?? 'Could not save the schedule item. Please try again.');
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

    const input: ScheduleItemInsert = {
      family_id: profile.family_id,
      kid_id: kidId,
      title: title.trim(),
      icon: trimmedIcon || null,
      start_time: startTime,
      end_time: endTime || null,
      days_of_week: daysOfWeek,
      active: true,
    };
    const { data, error } = await createScheduleItem(supabase, input);
    if (error || !data) {
      setFormError(error?.message ?? 'Could not create the schedule item. Please try again.');
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
        aria-labelledby="schedule-form-title"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-card bg-surface-card shadow-[0_20px_50px_rgba(32,36,58,0.25)] sm:rounded-card"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2
            id="schedule-form-title"
            className="font-display text-[22px] font-extrabold leading-tight text-ink-900"
          >
            {isEdit ? 'Edit schedule item' : 'Add schedule item'}
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
            {/* Kid picker */}
            <div className="flex flex-col gap-2">
              <span className="font-sans text-sm font-bold text-ink-900">Kid</span>
              {kids.length === 0 ? (
                <p className="font-sans text-[13px] font-semibold text-ink-500">
                  No kids in your family yet — add a kid first.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {kids.map(kid => {
                    const selected = kidId === kid.id;
                    return (
                      <button
                        key={kid.id}
                        type="button"
                        aria-pressed={selected}
                        disabled={submitting}
                        onClick={() => setKidId(kid.id)}
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
              {fieldErrors.kid && (
                <span className="font-sans text-[13px] font-semibold text-danger-ink">
                  {fieldErrors.kid}
                </span>
              )}
            </div>

            <Input
              ref={titleRef}
              label="Title"
              placeholder="e.g. Homework"
              maxLength={TITLE_MAX}
              value={title}
              disabled={submitting}
              error={fieldErrors.title}
              onChange={e => setTitle(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Start time"
                type="time"
                value={startTime}
                disabled={submitting}
                error={fieldErrors.startTime}
                onChange={e => setStartTime(e.target.value)}
              />
              <Input
                label="End time (optional)"
                type="time"
                value={endTime}
                disabled={submitting}
                error={fieldErrors.endTime}
                onChange={e => setEndTime(e.target.value)}
              />
            </div>

            <Input
              label="Icon (optional)"
              placeholder="e.g. book"
              autoCapitalize="none"
              autoCorrect="off"
              hint="A lucide icon name."
              value={icon}
              disabled={submitting}
              onChange={e => setIcon(e.target.value)}
            />

            {/* Days of week */}
            <div className="flex flex-col gap-2">
              <span className="font-sans text-sm font-bold text-ink-900">
                Repeats on
                <span className="ml-1 font-semibold text-ink-500">(none selected = every day)</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map(day => {
                  const selected = days.includes(day.code);
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
            </div>

            {/* Active toggle — edit only (new items start active) */}
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
                    (inactive items are hidden from the kid timeline)
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
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={submitting}
              disabled={kids.length === 0}
            >
              {isEdit ? 'Save changes' : 'Create item'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
