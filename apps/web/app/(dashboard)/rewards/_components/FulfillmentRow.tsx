'use client';

import type { FulfillmentItem } from '@lootloop/client';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { initial, relativeTime } from './format';

interface FulfillmentRowProps {
  item: FulfillmentItem;
  busy: boolean;
  error: string;
  onGiven: () => void;
}

// One purchased reward awaiting hand-off: reward emoji tile + title, the kid who
// bought it, the cost paid, when it was purchased, and a "Mark as given" action.
export function FulfillmentRow({ item, busy, error, onGiven }: FulfillmentRowProps) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {/* Reward emoji tile */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-indigo-soft text-xl">
          <span aria-hidden="true">{item.reward_emoji ?? '🎁'}</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-display text-[15px] font-extrabold text-ink-900">
            {item.reward_title}
          </span>
          <span className="flex items-center gap-1.5 font-sans text-[13px] font-bold text-ink-500">
            <KidBadge name={item.kid_display_name} avatarUrl={item.kid_avatar_url} />
            <span className="truncate">{item.kid_display_name}</span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">{relativeTime(item.purchased_at)}</span>
          </span>
        </div>

        {/* Cost paid */}
        <span className="flex shrink-0 items-center gap-1 rounded-pill bg-coin-soft px-3 py-1 font-display text-sm font-extrabold text-coin-ink">
          <span aria-hidden="true">🪙</span>
          {item.cost}
        </span>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="flex">
        <Button variant="primary" size="sm" block loading={busy} onClick={onGiven}>
          Mark as given
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
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint-soft font-display text-[11px] font-extrabold text-mint-ink"
    >
      {initial(name)}
    </span>
  );
}
