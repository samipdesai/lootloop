'use client';

import type { KidProfile } from '@lootloop/client';
import { Button } from '@/components/ui/Button';
import { ageModeLabel } from './ageMode';

interface KidRowProps {
  kid: KidProfile;
  onEdit: (kid: KidProfile) => void;
  onChangePin: (kid: KidProfile) => void;
  onGiveBonus: (kid: KidProfile) => void;
  onViewHistory: (kid: KidProfile) => void;
  onDelete: (kid: KidProfile) => void;
  deleting: boolean;
}

export function KidRow({
  kid,
  onEdit,
  onChangePin,
  onGiveBonus,
  onViewHistory,
  onDelete,
  deleting,
}: KidRowProps) {
  const initial = kid.display_name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="flex items-center gap-3 rounded-card bg-surface-card p-4 shadow-[0_4px_14px_rgba(32,36,58,0.07)] sm:gap-4 sm:p-5">
      {kid.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={kid.avatar_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
      ) : (
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-soft font-display text-lg font-extrabold text-indigo-ink"
        >
          {initial}
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate font-display text-[15px] font-extrabold text-ink-900">
          {kid.display_name}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-pill bg-indigo-soft px-2.5 py-0.5 font-display text-[13px] font-bold text-indigo-ink">
            {ageModeLabel(kid.age_mode)}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onGiveBonus(kid)}
          disabled={deleting}
        >
          Give bonus
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onViewHistory(kid)}
          disabled={deleting}
        >
          History
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onEdit(kid)}
          disabled={deleting}
        >
          Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChangePin(kid)}
          disabled={deleting}
        >
          Change PIN
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDelete(kid)}
          loading={deleting}
          className="text-danger-ink hover:text-danger"
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
