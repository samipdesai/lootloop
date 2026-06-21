'use client';

import { useEffect, useMemo, useState } from 'react';
import { listChores, listKids, deleteChore, type Chore, type KidProfile } from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ChoreRow } from './ChoreRow';
import { ChoreForm } from './ChoreForm';

// `form` state: null = closed, 'new' = create, Chore = editing that chore.
type FormState = null | 'new' | Chore;

export function ChoresClient() {
  const [chores, setChores] = useState<Chore[]>([]);
  const [kids, setKids] = useState<KidProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [form, setForm] = useState<FormState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  // Bumped by the "Try again" button to re-run the load effect. The effect owns
  // the fetch (setState only after `await`, matching ApprovalQueue) so the mount
  // load stays free of a synchronous setState.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const [choresRes, kidsRes] = await Promise.all([listChores(supabase), listKids(supabase)]);
      if (cancelled) return;

      if (choresRes.error || kidsRes.error) {
        setLoadError(
          choresRes.error?.message ??
            kidsRes.error?.message ??
            'Could not load your chores. Please try again.',
        );
        setLoading(false);
        return;
      }
      setChores(choresRes.data ?? []);
      setKids(kidsRes.data ?? []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Retry path (user event, not an effect): re-enter loading, then re-run effect.
  function reload() {
    setLoading(true);
    setLoadError('');
    setReloadKey(k => k + 1);
  }

  const kidNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const k of kids) m.set(k.id, k.display_name);
    return m;
  }, [kids]);

  // Merge a created/updated chore into the list without a full refetch. New
  // chores go to the top (matching listChores newest-first ordering).
  function handleSaved(saved: Chore) {
    setChores(prev => {
      const exists = prev.some(c => c.id === saved.id);
      return exists ? prev.map(c => (c.id === saved.id ? saved : c)) : [saved, ...prev];
    });
    setForm(null);
  }

  async function handleDelete(chore: Chore) {
    if (!window.confirm(`Delete "${chore.title}"? This can't be undone.`)) return;
    setActionError('');
    setDeletingId(chore.id);
    const supabase = createClient();
    const { error } = await deleteChore(supabase, chore.id);
    if (error) {
      setActionError(error.message ?? 'Could not delete the chore. Please try again.');
      setDeletingId(null);
      return;
    }
    setChores(prev => prev.filter(c => c.id !== chore.id));
    setDeletingId(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[28px] font-extrabold leading-tight text-ink-900">
          Chores
        </h1>
        {!loading && !loadError && (
          <Button type="button" variant="primary" size="md" onClick={() => setForm('new')}>
            Add chore
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
      ) : chores.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 py-14 text-center">
          <div className="text-5xl" aria-hidden>
            🧹
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="font-display text-xl font-extrabold text-ink-800">No chores yet</p>
            <p className="max-w-sm font-sans text-base font-semibold text-ink-500">
              Add your first chore to start earning loot.
            </p>
          </div>
          <Button type="button" variant="primary" size="md" onClick={() => setForm('new')}>
            Add your first chore
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {chores.map(chore => (
            <ChoreRow
              key={chore.id}
              chore={chore}
              kidNames={kidNames}
              onEdit={c => setForm(c)}
              onDelete={handleDelete}
              deleting={deletingId === chore.id}
            />
          ))}
        </div>
      )}

      {form !== null && (
        <ChoreForm
          kids={kids}
          chore={form === 'new' ? null : form}
          onClose={() => setForm(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading chores">
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
