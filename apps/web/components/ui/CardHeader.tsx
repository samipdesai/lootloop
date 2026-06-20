// Title + subtitle block atop an auth card (spec §5 anatomy).
export function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="font-display text-[26px] font-extrabold leading-tight text-ink-900">
        {title}
      </h1>
      {subtitle && <p className="font-sans text-base font-semibold text-ink-500">{subtitle}</p>}
    </div>
  );
}
