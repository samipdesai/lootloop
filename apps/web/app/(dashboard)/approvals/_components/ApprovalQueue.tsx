'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getMyParentProfile,
  listPendingCompletions,
  approveCompletion,
  rejectCompletion,
  type PendingCompletion,
} from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ApprovalRow } from './ApprovalRow';
import { Toast } from './Toast';

type RowBusy = 'approve' | 'reject' | null;

interface ToastState {
  message: string;
  tone: 'mint' | 'neutral';
}

// Client-driven Approval Queue (task #17) wired to the atomic award fn (task
// #18). Loads the parent profile (reviewerId) + pending completions on mount,
// then approves/rejects per-row with optimistic removal and inline feedback.
export function ApprovalQueue() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reviewerId, setReviewerId] = useState<string | null>(null);
  const [completions, setCompletions] = useState<PendingCompletion[]>([]);

  // Per-row state keyed by completion id.
  const [busy, setBusy] = useState<Record<string, RowBusy>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const client = createClient();

    (async () => {
      const [profileRes, pendingRes] = await Promise.all([
        getMyParentProfile(client),
        listPendingCompletions(client),
      ]);
      if (cancelled) return;

      if (profileRes.error || !profileRes.data) {
        setLoadError('Could not load your account. Please refresh and try again.');
        setLoading(false);
        return;
      }
      if (pendingRes.error || !pendingRes.data) {
        setLoadError('Could not load the approval queue. Please refresh and try again.');
        setLoading(false);
        return;
      }

      setReviewerId(profileRes.data.id);
      setCompletions(pendingRes.data);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAction = useCallback(
    async (c: PendingCompletion, action: 'approve' | 'reject') => {
      if (!reviewerId) return;
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
      setToast(
        action === 'approve'
          ? { message: `+${c.points} points awarded to ${c.kid_display_name} 🪙`, tone: 'mint' }
          : { message: 'Chore sent back — no points awarded', tone: 'neutral' },
      );
    },
    [reviewerId],
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
      <>
        <Card className="flex flex-col items-center gap-3 py-14 text-center">
          <div className="text-5xl" aria-hidden="true">
            🎉
          </div>
          <p className="font-display text-xl font-extrabold text-ink-800">All caught up</p>
          <p className="max-w-sm font-sans text-base font-semibold text-ink-500">
            No chores waiting for approval right now.
          </p>
        </Card>
        {toast && (
          <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />
        )}
      </>
    );
  }

  return (
    <>
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
      {toast && (
        <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />
      )}
    </>
  );
}
