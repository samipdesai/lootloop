'use client';

import { useEffect, useState } from 'react';
import { getMyParentProfile } from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { ChoreQueue } from './ChoreQueue';
import { ReadingQueue } from './ReadingQueue';
import { Toast, type ToastState } from './Toast';

type Tab = 'chores' | 'reading';

// Parent Approval Queue. Loads the parent profile (reviewerId) once, then splits
// into Chores (tasks #17/#18) and Reading (task #28) tabs. Each tab owns its own
// pending list + per-row approve/reject; the shared reviewerId and toast surface
// live here so the two queues stay independent but consistent.
export function ApprovalQueue() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reviewerId, setReviewerId] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>('chores');
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const client = createClient();

    (async () => {
      const profileRes = await getMyParentProfile(client);
      if (cancelled) return;

      if (profileRes.error || !profileRes.data) {
        setLoadError('Could not load your account. Please refresh and try again.');
        setLoading(false);
        return;
      }

      setReviewerId(profileRes.data.id);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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

  if (loadError || !reviewerId) {
    return <ErrorBanner>{loadError || 'Could not load your account.'}</ErrorBanner>;
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        <SegmentedTabs
          tabs={[
            { value: 'chores', label: 'Chores' },
            { value: 'reading', label: 'Reading' },
          ]}
          value={tab}
          onChange={v => setTab(v as Tab)}
        />

        {tab === 'chores' ? (
          <ChoreQueue reviewerId={reviewerId} onToast={setToast} />
        ) : (
          <ReadingQueue reviewerId={reviewerId} onToast={setToast} />
        )}
      </div>

      {toast && (
        <Toast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />
      )}
    </>
  );
}
