'use client';

import type { Reward } from '@lootloop/client';
import { Button } from '@/components/ui/Button';

interface RewardCardProps {
  reward: Reward;
  onEdit: (reward: Reward) => void;
  onDelete: (reward: Reward) => void;
  deleting: boolean;
}

// A reward-store item tile (task #22), translating design/components/money/
// RewardCard.jsx to Tailwind tokens: indigo-soft emoji/image header, display
// title, a coin cost badge, plus parent Edit/Delete actions. Inactive rewards
// dim and carry an "Inactive" chip.
export function RewardCard({ reward, onEdit, onDelete, deleting }: RewardCardProps) {
  const inactive = !reward.active;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-card bg-surface-card shadow-[0_4px_14px_rgba(32,36,58,0.07)] ${
        inactive ? 'opacity-65' : ''
      }`}
    >
      <div className="flex h-24 items-center justify-center bg-indigo-soft text-5xl leading-none">
        {reward.image_url ? (
          // Reward images are remote/arbitrary URLs; next/image would need host
          // config, so a plain <img> is the pragmatic choice here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reward.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden>{reward.emoji ?? '🎁'}</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <span className="min-w-0 flex-1 font-display text-[15px] font-extrabold leading-tight text-ink-900">
              {reward.title}
            </span>
            {inactive && (
              <span className="shrink-0 rounded-pill bg-ink-100 px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-wide text-ink-500">
                Inactive
              </span>
            )}
          </div>

          {/* Cost / coin badge */}
          <span className="inline-flex w-fit items-center gap-1 rounded-pill bg-coin-soft px-2.5 py-0.5 font-display text-[13px] font-bold text-coin-ink">
            <span aria-hidden className="h-3 w-3 rounded-full bg-coin-strong" />
            {reward.cost} pts
          </span>
        </div>

        <div className="mt-auto flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(reward)}
            disabled={deleting}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onDelete(reward)}
            loading={deleting}
            className="text-danger-ink hover:text-danger"
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
