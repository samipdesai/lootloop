'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from './nav-items';

// Vertical nav rail shown on md+ (task #10). Active link is highlighted by the
// current path; '/' must match exactly so it isn't active on every route.
export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Dashboard" className="flex flex-col gap-1">
      {NAV_ITEMS.map(item => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-pill px-4 py-2.5 font-display text-[15px] font-bold transition-colors ${
              active
                ? 'bg-orange-soft text-orange-ink'
                : 'text-ink-500 hover:bg-ink-100 hover:text-ink-800'
            }`}
          >
            <span className={active ? 'text-orange-strong' : 'text-ink-400'}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
