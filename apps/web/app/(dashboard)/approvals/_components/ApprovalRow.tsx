'use client';

import type { PendingCompletion } from '@lootloop/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { initial, relativeTime } from './format';

interface ApprovalRowProps {
  completion: PendingCompletion;
  // 'approve' | 'reject' while that action is in flight; null when idle.
  busy: 'approve' | 'reject' | null;
  error: string;
  onApprove: () => void;
  onReject: () => void;
}

// One pending completion: chore icon tile + title, kid identity, points to be
// awarded, submitted time, and Approve / Reject actions. Both buttons disable
// while either request is in flight; the active one shows a spinner.
export function ApprovalRow({ completion: c, busy, error, onApprove, onReject }: ApprovalRowProps) {
  const isBusy = busy !== null;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {/* Chore icon tile */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-coin-soft text-xl">
          <span aria-hidden="true">{c.chore_icon ?? '🧹'}</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-display text-[15px] font-extrabold text-ink-900">
            {c.chore_title}
          </span>
          <span className="flex items-center gap-1.5 font-sans text-[13px] font-bold text-ink-500">
            <KidBadge name={c.kid_display_name} avatarUrl={c.kid_avatar_url} />
            <span className="truncate">{c.kid_display_name}</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">{relativeTime(c.submitted_at)}</span>
          </span>
        </div>

        {/* Points to be awarded */}
        <span className="flex shrink-0 items-center gap-1 rounded-pill bg-coin-soft px-3 py-1 font-display text-sm font-extrabold text-coin-ink">
          <span aria-hidden="true">🪙</span>
          {c.points}
        </span>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="flex gap-2.5">
        <Button
          variant="ghost"
          size="sm"
          block
          disabled={isBusy}
          loading={busy === 'reject'}
          onClick={onReject}
        >
          Reject
        </Button>
        <Button
          variant="primary"
          size="sm"
          block
          disabled={isBusy}
          loading={busy === 'approve'}
          onClick={onApprove}
        >
          Approve & pay
        </Button>
      </div>
    </Card>
  );
}

// Avatar image when present, otherwise a circular initial chip.
function KidBadge({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    // Kid avatars are remote/arbitrary URLs; next/image would need host config,
    // so a plain <img> is the pragmatic choice for this small inline badge.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-soft font-display text-[11px] font-extrabold text-indigo-ink"
    >
      {initial(name)}
    </span>
  );
}
