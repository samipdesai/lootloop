import type { ReactNode } from 'react';

// The v1 parent dashboard sections (task #10). Order is the nav order.
// Icons are inline SVGs (currentColor) — no icon dependency added.
export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'Home',
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </svg>
    ),
  },
  {
    href: '/chores',
    label: 'Chores',
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M9 11.5 11 13.5 15 9" />
        <rect x="3" y="3" width="18" height="18" rx="5" />
      </svg>
    ),
  },
  {
    href: '/rewards',
    label: 'Rewards',
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M20 12v9H4v-9" />
        <rect x="2" y="7" width="20" height="5" rx="1.5" />
        <path d="M12 7V21" />
        <path d="M12 7S10.5 3 8 3a2.5 2.5 0 0 0 0 5h4" />
        <path d="M12 7s1.5-4 4-4a2.5 2.5 0 0 1 0 5h-4" />
      </svg>
    ),
  },
  {
    href: '/approvals',
    label: 'Approvals',
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ),
  },
  {
    href: '/kids',
    label: 'Kids',
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
        <path d="M16 7.5a3 3 0 0 1 0 5.6" />
        <path d="M17 20a5.5 5.5 0 0 0-2.5-4.6" />
      </svg>
    ),
  },
  {
    href: '/family',
    label: 'Family',
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <circle cx="12" cy="7" r="3.2" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M18.5 9.5a2.6 2.6 0 0 0 0-5" />
        <path d="M5.5 9.5a2.6 2.6 0 0 1 0-5" />
      </svg>
    ),
  },
  {
    href: '/schedule',
    label: 'Schedule',
    icon: (
      <svg {...iconProps} aria-hidden="true">
        <rect x="3" y="4.5" width="18" height="16.5" rx="3" />
        <path d="M3 9h18" />
        <path d="M8 2.5v4M16 2.5v4" />
      </svg>
    ),
  },
];
