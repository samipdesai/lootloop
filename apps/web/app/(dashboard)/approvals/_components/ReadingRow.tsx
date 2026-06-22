'use client';

import { useState } from 'react';
import type { PendingReadingLog } from '@lootloop/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { initial, shortDate } from './format';

const DEFAULT_POINTS = 10;

interface ReadingRowProps {
  log: PendingReadingLog;
  // 'approve' | 'reject' while that action is in flight; null when idle.
  busy: 'approve' | 'reject' | null;
  error: string;
  // Approve awards parent-chosen points (integer > 0).
  onApprove: (points: number) => void;
  onReject: () => void;
}

// One pending reading log: book icon tile + title, kid identity, minutes read,
// read-on date, an editable points input, and Approve / Reject actions. Reading
// points are parent-chosen (not a fixed snapshot), so each row carries its own
// points field. Both buttons disable while either request is in flight; the
// active one shows a spinner.
export function ReadingRow({ log, busy, error, onApprove, onReject }: ReadingRowProps) {
  const isBusy = busy !== null;
  const [points, setPoints] = useState(String(DEFAULT_POINTS));

  const parsed = Number(points);
  const pointsValid = Number.isInteger(parsed) && parsed > 0;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {/* Book / reading icon tile */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-indigo-soft text-xl">
          <span aria-hidden="true">📚</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-display text-[15px] font-extrabold text-ink-900">
            {log.book_title}
          </span>
          <span className="flex items-center gap-1.5 font-sans text-[13px] font-bold text-ink-500">
            <KidBadge name={log.kid_display_name} avatarUrl={log.kid_avatar_url} />
            <span className="truncate">{log.kid_display_name}</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">{log.minutes} min</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">{shortDate(log.read_on)}</span>
          </span>
        </div>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="flex items-end gap-2.5">
        <div className="w-24 shrink-0">
          <Input
            label="Points"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={points}
            disabled={isBusy}
            error={!pointsValid ? ' ' : undefined}
            onChange={e => setPoints(e.target.value)}
            aria-label={`Points to award ${log.kid_display_name} for reading ${log.book_title}`}
          />
        </div>
        <div className="flex flex-1 gap-2.5">
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
            disabled={isBusy || !pointsValid}
            loading={busy === 'approve'}
            onClick={() => onApprove(parsed)}
          >
            Approve & pay
          </Button>
        </div>
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
