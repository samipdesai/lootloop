// Icon tile for a chore row. lucide-react isn't a web dependency, so we render
// a tonal rounded tile with a small textual representation of the lucide icon
// name (first two letters) as a stand-in glyph. When no icon is set we show a
// generic checklist mark. Visual intent mirrors design/ui_kits/app/Chores.jsx.
export function ChoreIcon({ icon, muted = false }: { icon: string | null; muted?: boolean }) {
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
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      )}
    </div>
  );
}
