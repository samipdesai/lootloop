'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  listPendingReadingLogs,
  approveReadingLog,
  rejectReadingLog,
  type PendingReadingLog,
} from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ReadingRow } from './ReadingRow';
import type { ToastState } from './Toast';

type RowBusy = 'approve' | 'reject' | null;

interface ReadingQueueProps {
  reviewerId: string;
  onToast: (toast: ToastState) => void;
}

// Reading-log side of the approval queue (task #28). Loads pending reading logs
// on mount, then approves (awarding parent-chosen points + bumping the streak,
// atomically) or rejects per-row with optimistic removal and inline feedback.
// reviewerId is supplied by the parent ApprovalQueue (loaded once, shared).
export function ReadingQueue({ reviewerId, onToast }: ReadingQueueProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [logs, setLogs] = useState<PendingReadingLog[]>([]);

  // Per-row state keyed by reading-log id.
  const [busy, setBusy] = useState<Record<string, RowBusy>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const client = createClient();

    (async () => {
      const pendingRes = await listPendingReadingLogs(client);
      if (cancelled) return;

      if (pendingRes.error || !pendingRes.data) {
        setLoadError('Could not load reading entries. Please refresh and try again.');
        setLoading(false);
        return;
      }

      setLogs(pendingRes.data);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleApprove = useCallback(
    async (log: PendingReadingLog, points: number) => {
      const client = createClient();

      setBusy(b => ({ ...b, [log.id]: 'approve' }));
      setRowErrors(e => ({ ...e, [log.id]: '' }));

      const { error } = await approveReadingLog(client, log.id, reviewerId, points);

      if (error) {
        setRowErrors(e => ({
          ...e,
          [log.id]: 'Could not approve this reading entry. Please try again.',
        }));
        setBusy(b => ({ ...b, [log.id]: null }));
        return;
      }

      setLogs(list => list.filter(x => x.id !== log.id));
      setBusy(b => {
        const next = { ...b };
        delete next[log.id];
        return next;
      });
      onToast({
        message: `+${points} points awarded to ${log.kid_display_name} for reading 📚`,
        tone: 'mint',
      });
    },
    [reviewerId, onToast],
  );

  const handleReject = useCallback(
    async (log: PendingReadingLog) => {
      const client = createClient();

      setBusy(b => ({ ...b, [log.id]: 'reject' }));
      setRowErrors(e => ({ ...e, [log.id]: '' }));

      const { error } = await rejectReadingLog(client, log.id, reviewerId);

      if (error) {
        setRowErrors(e => ({
          ...e,
          [log.id]: 'Could not reject this reading entry. Please try again.',
        }));
        setBusy(b => ({ ...b, [log.id]: null }));
        return;
      }

      setLogs(list => list.filter(x => x.id !== log.id));
      setBusy(b => {
        const next = { ...b };
        delete next[log.id];
        return next;
      });
      onToast({ message: 'Reading entry sent back — no points awarded', tone: 'neutral' });
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
        <span className="font-display text-base font-bold text-ink-500">
          Loading reading entries…
        </span>
      </Card>
    );
  }

  if (loadError) {
    return <ErrorBanner>{loadError}</ErrorBanner>;
  }

  if (logs.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 py-14 text-center">
        <div className="text-5xl" aria-hidden="true">
          📚
        </div>
        <p className="font-display text-xl font-extrabold text-ink-800">
          No reading entries waiting 📚
        </p>
        <p className="max-w-sm font-sans text-base font-semibold text-ink-500">
          Reading logs your kids submit will show up here for approval.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {logs.map(log => (
        <ReadingRow
          key={log.id}
          log={log}
          busy={busy[log.id] ?? null}
          error={rowErrors[log.id] ?? ''}
          onApprove={points => handleApprove(log, points)}
          onReject={() => handleReject(log)}
        />
      ))}
    </div>
  );
}
