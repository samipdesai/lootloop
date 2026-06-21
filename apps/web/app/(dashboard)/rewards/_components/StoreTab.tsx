'use client';

import { useEffect, useState } from 'react';
import { listRewards, deleteReward, type Reward } from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { RewardCard } from './RewardCard';
import { RewardForm } from './RewardForm';

// `form` state: null = closed, 'new' = create, Reward = editing that reward.
type FormState = null | 'new' | Reward;

// Reward store catalog (task #22): lists every reward (active + inactive),
// newest first, with Edit/Delete and an Add-reward modal reused for editing.
// Mirrors ChoresClient's load/retry/in-place-merge pattern.
export function StoreTab() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [form, setForm] = useState<FormState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  // Bumped by "Try again" to re-run the load effect (matching ChoresClient).
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const { data, error } = await listRewards(supabase);
      if (cancelled) return;

      if (error) {
        setLoadError(error.message ?? 'Could not load your rewards. Please try again.');
        setLoading(false);
        return;
      }
      setRewards(data ?? []);
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

  // Merge a created/updated reward into the list without a full refetch. New
  // rewards go to the top (matching listRewards newest-first ordering).
  function handleSaved(saved: Reward) {
    setRewards(prev => {
      const exists = prev.some(r => r.id === saved.id);
      return exists ? prev.map(r => (r.id === saved.id ? saved : r)) : [saved, ...prev];
    });
    setForm(null);
  }

  async function handleDelete(reward: Reward) {
    if (!window.confirm(`Delete "${reward.title}"? This can't be undone.`)) return;
    setActionError('');
    setDeletingId(reward.id);
    const supabase = createClient();
    const { error } = await deleteReward(supabase, reward.id);
    if (error) {
      setActionError(error.message ?? 'Could not delete the reward. Please try again.');
      setDeletingId(null);
      return;
    }
    setRewards(prev => prev.filter(r => r.id !== reward.id));
    setDeletingId(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-sans text-base font-semibold text-ink-500">
          Items kids can buy with the loot they earn.
        </p>
        {!loading && !loadError && rewards.length > 0 && (
          <Button type="button" variant="primary" size="md" onClick={() => setForm('new')}>
            Add reward
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
      ) : rewards.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 py-14 text-center">
          <div className="text-5xl" aria-hidden>
            🎁
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="font-display text-xl font-extrabold text-ink-800">No rewards yet</p>
            <p className="max-w-sm font-sans text-base font-semibold text-ink-500">
              Add your first reward to give kids something to save up for.
            </p>
          </div>
          <Button type="button" variant="primary" size="md" onClick={() => setForm('new')}>
            Add your first reward
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map(reward => (
            <RewardCard
              key={reward.id}
              reward={reward}
              onEdit={r => setForm(r)}
              onDelete={handleDelete}
              deleting={deletingId === reward.id}
            />
          ))}
        </div>
      )}

      {form !== null && (
        <RewardForm
          reward={form === 'new' ? null : form}
          onClose={() => setForm(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Loading rewards"
    >
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="flex flex-col overflow-hidden rounded-card bg-surface-card shadow-[0_4px_14px_rgba(32,36,58,0.07)]"
        >
          <div className="h-24 animate-pulse bg-ink-100" />
          <div className="flex flex-col gap-2 p-5">
            <div className="h-4 w-2/3 animate-pulse rounded-pill bg-ink-100" />
            <div className="h-3 w-1/3 animate-pulse rounded-pill bg-ink-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
