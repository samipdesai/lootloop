import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { NAV_ITEMS } from '@/components/dashboard/nav-items';

// Dashboard home / overview placeholder (task #10). Lands here from the
// middleware redirect target ('/'). Real overview content arrives in a later task.
const OVERVIEW = NAV_ITEMS.filter(i => i.href !== '/');

export default function DashboardHome() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[28px] font-extrabold leading-tight text-ink-900">
          Welcome back 👋
        </h1>
        <p className="font-sans text-base font-semibold text-ink-500">
          Your family overview will live here. For now, jump into a section.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {OVERVIEW.map(item => (
          <Link key={item.href} href={item.href} className="group">
            <Card className="flex h-full items-center gap-4 transition-shadow group-hover:shadow-[0_12px_28px_rgba(32,36,58,0.14)]">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-orange-soft text-orange-strong">
                {item.icon}
              </span>
              <div className="flex flex-col">
                <span className="font-display text-[17px] font-extrabold text-ink-900">
                  {item.label}
                </span>
                <span className="font-sans text-sm font-semibold text-ink-400">Open</span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
