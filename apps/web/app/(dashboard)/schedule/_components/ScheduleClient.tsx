'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  listScheduleItems,
  listKids,
  deleteScheduleItem,
  type ScheduleItem,
  type KidProfile,
} from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScheduleItemRow } from './ScheduleItemRow';
import { ScheduleForm } from './ScheduleForm';

// `form` state: null = closed, 'new' = create, ScheduleItem = editing that item.
type FormState = null | 'new' | ScheduleItem;

// A kid header plus the items assigned to them. Items with a kid_id that no
// longer resolves to a kid are bucketed under an "Unknown kid" section so they
// stay visible (and deletable) rather than silently vanishing.
interface KidGroup {
  kidId: string;
  name: string;
  items: ScheduleItem[];
}

export function ScheduleClient() {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [kids, setKids] = useState<KidProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [form, setForm] = useState<FormState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  // Bumped by "Try again" to re-run the load effect (mirrors ChoresClient).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const [itemsRes, kidsRes] = await Promise.all([
        listScheduleItems(supabase),
        listKids(supabase),
      ]);
      if (cancelled) return;

      if (itemsRes.error || kidsRes.error) {
        setLoadError(
          itemsRes.error?.message ??
            kidsRes.error?.message ??
            'Could not load the schedule. Please try again.',
        );
        setLoading(false);
        return;
      }
      setItems(itemsRes.data ?? []);
      setKids(kidsRes.data ?? []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function reload() {
    setLoading(true);
    setLoadError('');
    setReloadKey(k => k + 1);
  }

  // Group items by kid, in the kid order returned by listKids. listScheduleItems
  // already orders by start_time within each kid. Orphan items (kid removed) get
  // their own trailing section.
  const groups = useMemo<KidGroup[]>(() => {
    const byKid = new Map<string, ScheduleItem[]>();
    for (const item of items) {
      const bucket = byKid.get(item.kid_id);
      if (bucket) bucket.push(item);
      else byKid.set(item.kid_id, [item]);
    }

    const result: KidGroup[] = [];
    for (const kid of kids) {
      const kidItems = byKid.get(kid.id);
      if (kidItems) {
        result.push({ kidId: kid.id, name: kid.display_name, items: kidItems });
        byKid.delete(kid.id);
      }
    }
    // Any remaining buckets reference kids not in listKids — surface them.
    for (const [kidId, kidItems] of byKid) {
      result.push({ kidId, name: 'Unknown kid', items: kidItems });
    }
    return result;
  }, [items, kids]);

  // Merge a created/updated item into the list without a refetch.
  function handleSaved(saved: ScheduleItem) {
    setItems(prev => {
      const exists = prev.some(i => i.id === saved.id);
      return exists ? prev.map(i => (i.id === saved.id ? saved : i)) : [...prev, saved];
    });
    setForm(null);
  }

  async function handleDelete(item: ScheduleItem) {
    if (!window.confirm(`Delete "${item.title}"? This can't be undone.`)) return;
    setActionError('');
    setDeletingId(item.id);
    const supabase = createClient();
    const { error } = await deleteScheduleItem(supabase, item.id);
    if (error) {
      setActionError(error.message ?? 'Could not delete the schedule item. Please try again.');
      setDeletingId(null);
      return;
    }
    setItems(prev => prev.filter(i => i.id !== item.id));
    setDeletingId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[28px] font-extrabold leading-tight text-ink-900">
          Schedule
        </h1>
        {!loading && !loadError && (
          <Button type="button" variant="primary" size="md" onClick={() => setForm('new')}>
            Add schedule item
          </Button>
        )}
      </div>

      {actionError && <ErrorBanner>{actionError}</ErrorBanner>}

      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <Card className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="font-display text-lg font-extrabold text-ink-800">Something went wrong</p>
          <p className="max-w-sm font-sans text-base font-semibold text-ink-500">{loadError}</p>
          <Button type="button" variant="primary" size="md" onClick={reload}>
            Try again
          </Button>
        </Card>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 py-14 text-center">
          <div className="text-5xl" aria-hidden>
            🗓️
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="font-display text-xl font-extrabold text-ink-800">
              No schedule items yet
            </p>
            <p className="max-w-sm font-sans text-base font-semibold text-ink-500">
              Add a time-based item and it&apos;ll show up on your kid&apos;s daily timeline.
            </p>
          </div>
          <Button type="button" variant="primary" size="md" onClick={() => setForm('new')}>
            Add your first item
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map(group => (
            <section key={group.kidId} className="flex flex-col gap-3">
              <h2 className="font-display text-lg font-extrabold text-ink-800">{group.name}</h2>
              <div className="flex flex-col gap-3">
                {group.items.map(item => (
                  <ScheduleItemRow
                    key={item.id}
                    item={item}
                    onEdit={i => setForm(i)}
                    onDelete={handleDelete}
                    deleting={deletingId === item.id}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {form !== null && (
        <ScheduleForm
          kids={kids}
          item={form === 'new' ? null : form}
          onClose={() => setForm(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading schedule">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-card bg-surface-card p-5 shadow-[0_4px_14px_rgba(32,36,58,0.07)]"
        >
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-md bg-ink-100" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-1/3 animate-pulse rounded-pill bg-ink-100" />
            <div className="h-3 w-1/2 animate-pulse rounded-pill bg-ink-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
