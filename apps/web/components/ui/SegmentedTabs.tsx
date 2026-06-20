'use client';

interface Tab {
  value: string;
  label: string;
}

// Pill segmented control with role=tablist (design/components/core/Tabs.jsx +
// spec §10 a11y). Used by onboarding Create/Join toggle.
export function SegmentedTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="tablist" className="flex w-full gap-1 rounded-pill bg-ink-100 p-1">
      {tabs.map(t => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={`h-10 flex-1 rounded-pill font-display text-sm font-bold transition-all outline-none focus-visible:ring-2 focus-visible:ring-indigo-strong ${
              active
                ? 'bg-surface-card text-ink-900 shadow-[0_2px_6px_rgba(32,36,58,0.08)]'
                : 'bg-transparent text-ink-500'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
