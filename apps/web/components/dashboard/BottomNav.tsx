'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from './nav-items';

// Fixed bottom tab bar shown below md (task #10). Mirrors SidebarNav items so
// every section is reachable on mobile-browser widths.
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Dashboard"
      className="fixed inset-x-0 bottom-0 z-20 flex items-stretch justify-around border-t border-border bg-surface-card pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_rgba(32,36,58,0.08)] md:hidden"
    >
      {NAV_ITEMS.map(item => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 font-display text-[11px] font-bold transition-colors ${
              active ? 'text-orange-strong' : 'text-ink-400'
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
