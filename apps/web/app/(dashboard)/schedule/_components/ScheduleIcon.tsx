// Icon tile for a schedule-item row. Mirrors chores' ChoreIcon: lucide-react
// isn't a web dependency, so we render a tonal rounded tile with the first two
// letters of the lucide icon name as a stand-in glyph, falling back to a clock
// mark when no icon is set.
export function ScheduleIcon({ icon, muted = false }: { icon: string | null; muted?: boolean }) {
  const label = icon ? icon.slice(0, 2).toUpperCase() : null;
  return (
    <div
      aria-hidden
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md font-display text-sm font-extrabold ${
        muted ? 'bg-ink-100 text-ink-400' : 'bg-indigo-soft text-indigo-strong'
      }`}
    >
      {label ?? (
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      )}
    </div>
  );
}
