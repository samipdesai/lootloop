import { Card } from '@/components/ui/Card';

// "Coming soon" empty state for dashboard sections not yet built (task #10).
// Later tasks (#12, #17, #22, #36, …) replace these per-route pages.
export function PlaceholderPage({
  title,
  emoji,
  blurb,
  taskRef,
}: {
  title: string;
  emoji: string;
  blurb: string;
  taskRef?: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-[28px] font-extrabold leading-tight text-ink-900">{title}</h1>
      <Card className="flex flex-col items-center gap-4 py-14 text-center">
        <div className="text-5xl" aria-hidden="true">
          {emoji}
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="font-display text-xl font-extrabold text-ink-800">Coming soon</p>
          <p className="max-w-sm font-sans text-base font-semibold text-ink-500">{blurb}</p>
        </div>
        {taskRef && (
          <span className="rounded-pill bg-ink-100 px-3 py-1 font-display text-[12px] font-bold text-ink-500">
            {taskRef}
          </span>
        )}
      </Card>
    </div>
  );
}
