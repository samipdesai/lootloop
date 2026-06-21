// Pure presentation helpers for the kid's point-history ledger (#20). Kept
// separate from the screen so they're trivially unit-testable (no Supabase, no
// React). A ledger row maps a PointTransaction into the bits the UI renders: a
// kid-friendly type label, the signed/colored amount, and a relative date.
import type { PointTransaction } from '@lootloop/client';

export type LedgerTone = 'positive' | 'negative';

export interface LedgerRow {
  label: string; // Earned / Bonus / Spent / Refund
  tone: LedgerTone; // positive (mint, +) or negative (danger, −)
  amountText: string; // e.g. "+25" / "−10"
  emoji: string;
}

const TYPE: Record<PointTransaction['type'], { label: string; emoji: string }> = {
  earn: { label: 'Earned', emoji: '✅' },
  bonus: { label: 'Bonus', emoji: '⭐' },
  spend: { label: 'Spent', emoji: '🛍️' },
  refund: { label: 'Refund', emoji: '↩️' },
};

// Amount sign is the source of truth for tone/prefix (earn/bonus are +, spend is
// −, refund is +). We display the magnitude with an explicit +/− so a kid reads
// the direction at a glance.
export function ledgerRow(txn: Pick<PointTransaction, 'type' | 'amount'>): LedgerRow {
  const t = TYPE[txn.type];
  const positive = txn.amount >= 0;
  const magnitude = Math.abs(txn.amount).toLocaleString('en-US');
  return {
    label: t.label,
    emoji: t.emoji,
    tone: positive ? 'positive' : 'negative',
    amountText: `${positive ? '+' : '−'}${magnitude}`,
  };
}

// "Today" / "Yesterday" / "Mar 3" — a friendly, compact relative date for the
// ledger. `now` is injectable so the helper is deterministic in tests.
export function relativeDate(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((startOf(now) - startOf(then)) / dayMs);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
