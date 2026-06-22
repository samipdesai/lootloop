'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  listPendingCompletions,
  approveCompletion,
  rejectCompletion,
  subscribeToTable,
  type PendingCompletion,
} from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ApprovalRow } from './ApprovalRow';
import type { ToastState } from './Toast';

type RowBusy = 'approve' | 'reject' | null;

interface ChoreQueueProps {
  reviewerId: string;
  onToast: (toast: ToastState) => void;
}

// Chore-completion side of the approval queue (tasks #17/#18). Loads pending
// completions on mount, then approves/rejects per-row against the atomic award
// fn with optimistic removal and inline feedback. reviewerId is supplied by the
// parent ApprovalQueue (loaded once and shared with the reading tab).
export function ChoreQueue({ reviewerId, onToast }: ChoreQueueProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [completions, setCompletions] = useState<PendingCompletion[]>([]);

  // Per-row state keyed by completion id.
  const [busy, setBusy] = useState<Record<string, RowBusy>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  // Live refresh (task #41): a kid completing a chore inserts/updates a pending
  // chore_completions row. RLS scopes change events to this parent's family, so
  // we subscribe unfiltered and refetch the queue on each event. We don't have
  // family_id in this component's props (only reviewerId), hence no filter.
  useEffect(() => {
    let cancelled = false;
    const client = createClient();

    const load = async () => {
      const pendingRes = await listPendingCompletions(client);
      if (cancelled) return;

      if (pendingRes.error || !pendingRes.data) {
        setLoadError('Could not load the approval queue. Please refresh and try again.');
        setLoading(false);
        return;
      }

      setCompletions(pendingRes.data);
      setLoading(false);
    };

    void load();

    const unsubscribe = subscribeToTable(client, {
      table: 'chore_completions',
      onChange: () => {
        void load();
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const handleAction = useCallback(
    async (c: PendingCompletion, action: 'approve' | 'reject') => {
      const client = createClient();

      setBusy(b => ({ ...b, [c.id]: action }));
      setRowErrors(e => ({ ...e, [c.id]: '' }));

      const { error } =
        action === 'approve'
          ? await approveCompletion(client, c.id, reviewerId)
          : await rejectCompletion(client, c.id, reviewerId);

      if (error) {
        setRowErrors(e => ({
          ...e,
          [c.id]:
            action === 'approve'
              ? 'Could not approve this chore. Please try again.'
              : 'Could not reject this chore. Please try again.',
        }));
        setBusy(b => ({ ...b, [c.id]: null }));
        return;
      }

      // Success: drop the row and confirm.
      setCompletions(list => list.filter(x => x.id !== c.id));
      setBusy(b => {
        const next = { ...b };
        delete next[c.id];
        return next;
      });
      onToast(
        action === 'approve'
          ? { message: `+${c.points} points awarded to ${c.kid_display_name} 🪙`, tone: 'mint' }
          : { message: 'Chore sent back — no points awarded', tone: 'neutral' },
      );
    },
    [reviewerId, onToast],
  );

  if (loading) {
    return (
      <Card className="flex items-center justify-center gap-3 py-14">
        <span
          aria-hidden="true"
          className="h-6 w-6 animate-spin rounded-full border-[3px] border-ink-200 border-t-orange-strong"
        />
        <span className="font-display text-base font-bold text-ink-500">Loading approvals…</span>
      </Card>
    );
  }

  if (loadError) {
    return <ErrorBanner>{loadError}</ErrorBanner>;
  }

  if (completions.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 py-14 text-center">
        <div className="text-5xl" aria-hidden="true">
          🎉
        </div>
        <p className="font-display text-xl font-extrabold text-ink-800">All caught up</p>
        <p className="max-w-sm font-sans text-base font-semibold text-ink-500">
          No chores waiting for approval right now.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {completions.map(c => (
        <ApprovalRow
          key={c.id}
          completion={c}
          busy={busy[c.id] ?? null}
          error={rowErrors[c.id] ?? ''}
          onApprove={() => handleAction(c, 'approve')}
          onReject={() => handleAction(c, 'reject')}
        />
      ))}
    </div>
  );
}
