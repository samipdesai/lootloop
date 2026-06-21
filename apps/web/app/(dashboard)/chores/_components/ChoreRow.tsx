'use client';

import type { Chore } from '@lootloop/client';
import { Button } from '@/components/ui/Button';
import { ChoreIcon } from './ChoreIcon';
import { describeRecurrence } from './recurrence';

interface ChoreRowProps {
  chore: Chore;
  // id → display_name, to resolve the assigned kid.
  kidNames: Map<string, string>;
  onEdit: (chore: Chore) => void;
  onDelete: (chore: Chore) => void;
  deleting: boolean;
}

export function ChoreRow({ chore, kidNames, onEdit, onDelete, deleting }: ChoreRowProps) {
  const inactive = !chore.active;
  const assignedName =
    chore.assignment === 'assigned' && chore.assigned_kid_id
      ? (kidNames.get(chore.assigned_kid_id) ?? 'Unknown kid')
      : null;

  return (
    <div
      className={`flex items-center gap-3 rounded-card bg-surface-card p-4 shadow-[0_4px_14px_rgba(32,36,58,0.07)] sm:gap-4 sm:p-5 ${
        inactive ? 'opacity-65' : ''
      }`}
    >
      <ChoreIcon icon={chore.icon} muted={inactive} />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-[15px] font-extrabold text-ink-900">
            {chore.title}
          </span>
          {inactive && (
            <span className="shrink-0 rounded-pill bg-ink-100 px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-wide text-ink-500">
              Inactive
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Points / coin badge */}
          <span className="inline-flex items-center gap-1 rounded-pill bg-coin-soft px-2.5 py-0.5 font-display text-[13px] font-bold text-coin-ink">
            <span aria-hidden className="h-3 w-3 rounded-full bg-coin-strong" />
            {chore.points} pts
          </span>

          {/* Assignment indicator */}
          {chore.assignment === 'shared' ? (
            <span className="rounded-pill bg-indigo-soft px-2.5 py-0.5 font-display text-[13px] font-bold text-indigo-ink">
              Shared
            </span>
          ) : (
            <span className="rounded-pill bg-mint-soft px-2.5 py-0.5 font-display text-[13px] font-bold text-mint-ink">
              {assignedName}
            </span>
          )}

          {/* Recurrence indicator */}
          <span className="rounded-pill bg-ink-100 px-2.5 py-0.5 font-display text-[13px] font-bold text-ink-500">
            {describeRecurrence(chore.recurrence_rule)}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onEdit(chore)}
          disabled={deleting}
        >
          Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDelete(chore)}
          loading={deleting}
          className="text-danger-ink hover:text-danger"
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
