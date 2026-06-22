'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getMyParentProfile,
  listPurchases,
  markPurchaseGiven,
  subscribeToTable,
  type FulfillmentItem,
} from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/Card';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { FulfillmentRow } from './FulfillmentRow';

// Fulfillment queue (task #25): rewards kids have purchased but a parent hasn't
// handed out yet (status 'purchased'). Each row has a "Mark as given" action
// (markPurchaseGiven → flips to 'given'); the row drops on success. Mirrors the
// ApprovalQueue load/per-row-busy/optimistic-removal pattern.
export function FulfillmentTab() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [items, setItems] = useState<FulfillmentItem[]>([]);

  // Per-row state keyed by purchase id.
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const client = createClient();

    (async () => {
      const [profileRes, purchasesRes] = await Promise.all([
        getMyParentProfile(client),
        listPurchases(client, 'purchased'),
      ]);
      if (cancelled) return;

      if (profileRes.error || !profileRes.data) {
        setLoadError('Could not load your account. Please refresh and try again.');
        setLoading(false);
        return;
      }
      if (purchasesRes.error || !purchasesRes.data) {
        setLoadError('Could not load the fulfillment queue. Please refresh and try again.');
        setLoading(false);
        return;
      }

      setParentId(profileRes.data.id);
      setFamilyId(profileRes.data.family_id);
      setItems(purchasesRes.data);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Live refresh (task #41): a kid purchasing a reward inserts a 'purchased'
  // reward_purchases row. Subscribe filtered by family_id (loaded above) and
  // refetch the pending queue on each event so new purchases appear live.
  useEffect(() => {
    if (!familyId) return;
    let cancelled = false;
    const client = createClient();

    const unsubscribe = subscribeToTable(client, {
      table: 'reward_purchases',
      filter: `family_id=eq.${familyId}`,
      onChange: () => {
        void (async () => {
          const purchasesRes = await listPurchases(client, 'purchased');
          if (cancelled || purchasesRes.error || !purchasesRes.data) return;
          setItems(purchasesRes.data);
        })();
      },
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [familyId]);

  const handleGiven = useCallback(
    async (item: FulfillmentItem) => {
      if (!parentId) return;
      const client = createClient();

      setBusy(b => ({ ...b, [item.id]: true }));
      setRowErrors(e => ({ ...e, [item.id]: '' }));

      const { error } = await markPurchaseGiven(client, item.id, parentId);

      if (error) {
        setRowErrors(e => ({
          ...e,
          [item.id]: 'Could not mark this as given. Please try again.',
        }));
        setBusy(b => ({ ...b, [item.id]: false }));
        return;
      }

      // Success: drop the row from the queue.
      setItems(list => list.filter(x => x.id !== item.id));
      setBusy(b => {
        const next = { ...b };
        delete next[item.id];
        return next;
      });
    },
    [parentId],
  );

  if (loading) {
    return (
      <Card className="flex items-center justify-center gap-3 py-14">
        <span
          aria-hidden="true"
          className="h-6 w-6 animate-spin rounded-full border-[3px] border-ink-200 border-t-orange-strong"
        />
        <span className="font-display text-base font-bold text-ink-500">Loading fulfillment…</span>
      </Card>
    );
  }

  if (loadError) {
    return <ErrorBanner>{loadError}</ErrorBanner>;
  }

  if (items.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 py-14 text-center">
        <div className="text-5xl" aria-hidden="true">
          🎁
        </div>
        <p className="font-display text-xl font-extrabold text-ink-800">Nothing to hand out</p>
        <p className="max-w-sm font-sans text-base font-semibold text-ink-500">
          When a kid buys a reward, it shows up here so you can give it to them.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map(item => (
        <FulfillmentRow
          key={item.id}
          item={item}
          busy={busy[item.id] ?? false}
          error={rowErrors[item.id] ?? ''}
          onGiven={() => handleGiven(item)}
        />
      ))}
    </div>
  );
}
