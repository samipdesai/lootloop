'use client';

import { useEffect, useState } from 'react';
import {
  getKidWallet,
  listPointTransactions,
  type KidProfile,
  type PointTransaction,
} from '@lootloop/client';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { Modal } from './Modal';
import { relativeTime } from './format';

interface PointHistoryModalProps {
  kid: KidProfile;
  onClose: () => void;
}

type TxnType = PointTransaction['type'];

// type → badge label + token classes. earn/bonus/refund read as positive credit;
// spend reads as debit (danger). Mirrors the coin/mint/danger token palette.
const TYPE_META: Record<TxnType, { label: string; badge: string }> = {
  earn: { label: 'Earned', badge: 'bg-mint-soft text-mint-ink' },
  bonus: { label: 'Bonus', badge: 'bg-coin-soft text-coin-ink' },
  spend: { label: 'Spent', badge: 'bg-danger-soft text-danger-ink' },
  refund: { label: 'Refund', badge: 'bg-indigo-soft text-indigo-ink' },
};

function signedAmount(amount: number): string {
  return amount >= 0 ? `+${amount}` : `${amount}`;
}

export function PointHistoryModal({ kid, onClose }: PointHistoryModalProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const [txns, setTxns] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const [walletRes, txnRes] = await Promise.all([
        getKidWallet(supabase, kid.id),
        listPointTransactions(supabase, kid.id),
      ]);
      if (cancelled) return;
      if (walletRes.error || txnRes.error) {
        setError(
          walletRes.error?.message ??
            txnRes.error?.message ??
            'Could not load point history. Please try again.',
        );
        setLoading(false);
        return;
      }
      setBalance(walletRes.data?.wallet_balance ?? 0);
      setTxns(txnRes.data ?? []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [kid.id, reloadKey]);

  function retry() {
    setLoading(true);
    setError('');
    setReloadKey(k => k + 1);
  }

  return (
    <Modal title={`Point history — ${kid.display_name}`} onClose={onClose}>
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Current balance header — always rendered (shows a placeholder while loading). */}
        <div className="flex items-center justify-between border-b border-border bg-coin-soft/40 px-6 py-4">
          <span className="font-sans text-sm font-bold text-ink-700">Current balance</span>
          <span className="font-display text-[22px] font-extrabold leading-none text-coin-ink">
            {loading || balance === null ? '—' : `${balance} pts`}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <LoadingLedger />
          ) : error ? (
            <div className="flex flex-col gap-4">
              <ErrorBanner>{error}</ErrorBanner>
              <Button type="button" variant="primary" size="md" onClick={retry}>
                Try again
              </Button>
            </div>
          ) : txns.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <div className="text-4xl" aria-hidden>
                🪙
              </div>
              <p className="font-display text-lg font-extrabold text-ink-800">No activity yet</p>
              <p className="max-w-xs font-sans text-sm font-semibold text-ink-500">
                Earned, bonus, and spent points will show up here.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {txns.map(txn => {
                const meta = TYPE_META[txn.type];
                const positive = txn.amount >= 0;
                return (
                  <li
                    key={txn.id}
                    className="flex items-center gap-3 rounded-md bg-ink-50 px-4 py-3"
                  >
                    <span
                      className={`shrink-0 rounded-pill px-2.5 py-0.5 font-display text-[13px] font-bold ${meta.badge}`}
                    >
                      {meta.label}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      {txn.note && (
                        <span className="truncate font-sans text-sm font-bold text-ink-900">
                          {txn.note}
                        </span>
                      )}
                      <span className="font-sans text-[13px] font-semibold text-ink-500">
                        {relativeTime(txn.created_at)}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 font-display text-[15px] font-extrabold tabular-nums ${
                        positive ? 'text-mint-ink' : 'text-danger-ink'
                      }`}
                    >
                      {signedAmount(txn.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-end border-t border-border px-6 py-4">
          <Button type="button" variant="ghost" size="md" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function LoadingLedger() {
  return (
    <ul className="flex flex-col gap-2" aria-busy="true" aria-label="Loading point history">
      {[0, 1, 2, 3].map(i => (
        <li key={i} className="flex items-center gap-3 rounded-md bg-ink-50 px-4 py-3">
          <div className="h-6 w-16 shrink-0 animate-pulse rounded-pill bg-ink-100" />
          <div className="h-4 flex-1 animate-pulse rounded-pill bg-ink-100" />
          <div className="h-4 w-10 shrink-0 animate-pulse rounded-pill bg-ink-100" />
        </li>
      ))}
    </ul>
  );
}
