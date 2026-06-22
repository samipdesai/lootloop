'use client';

import type { ScheduleItem } from '@lootloop/client';
import { Button } from '@/components/ui/Button';
import { ScheduleIcon } from './ScheduleIcon';
import { describeDays, formatTime } from './days';

interface ScheduleItemRowProps {
  item: ScheduleItem;
  onEdit: (item: ScheduleItem) => void;
  onDelete: (item: ScheduleItem) => void;
  deleting: boolean;
}

export function ScheduleItemRow({ item, onEdit, onDelete, deleting }: ScheduleItemRowProps) {
  const inactive = !item.active;
  const timeRange = item.end_time
    ? `${formatTime(item.start_time)} – ${formatTime(item.end_time)}`
    : formatTime(item.start_time);

  return (
    <div
      className={`flex items-center gap-3 rounded-card bg-surface-card p-4 shadow-[0_4px_14px_rgba(32,36,58,0.07)] sm:gap-4 sm:p-5 ${
        inactive ? 'opacity-65' : ''
      }`}
    >
      <ScheduleIcon icon={item.icon} muted={inactive} />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="truncate font-display text-[15px] font-extrabold text-ink-900">
            {item.title}
          </span>
          {inactive && (
            <span className="shrink-0 rounded-pill bg-ink-100 px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-wide text-ink-500">
              Inactive
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Time range */}
          <span className="inline-flex items-center gap-1 rounded-pill bg-indigo-soft px-2.5 py-0.5 font-display text-[13px] font-bold text-indigo-ink">
            {timeRange}
          </span>

          {/* Recurrence */}
          <span className="rounded-pill bg-ink-100 px-2.5 py-0.5 font-display text-[13px] font-bold text-ink-500">
            {describeDays(item.days_of_week)}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onEdit(item)}
          disabled={deleting}
        >
          Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDelete(item)}
          loading={deleting}
          className="text-danger-ink hover:text-danger"
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
