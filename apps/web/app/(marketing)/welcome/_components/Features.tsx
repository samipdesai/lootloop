import {
  BookOpen,
  CalendarClock,
  Gift,
  ListChecks,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Reveal } from './Reveal';

const FEATURES: {
  icon: LucideIcon;
  cardBg: string;
  iconBg: string;
  iconColor: string;
  bodyColor: string;
  title: string;
  body: string;
}[] = [
  {
    icon: ListChecks,
    cardBg: 'bg-orange-soft',
    iconBg: 'bg-orange',
    iconColor: 'text-white',
    bodyColor: 'text-orange-ink',
    title: 'Chores & approvals',
    body: 'Create, assign, and schedule recurring tasks. Kids claim them; you approve with a tap.',
  },
  {
    icon: Gift,
    cardBg: 'bg-indigo-soft',
    iconBg: 'bg-indigo',
    iconColor: 'text-white',
    bodyColor: 'text-indigo-ink',
    title: 'Reward store',
    body: 'Stock it with screen time, treats, or a big-ticket goal. Kids shop; you fulfill the order.',
  },
  {
    icon: TrendingUp,
    cardBg: 'bg-mint-soft',
    iconBg: 'bg-mint',
    iconColor: 'text-white',
    bodyColor: 'text-mint-ink',
    title: 'Savings & interest',
    body: 'Move loot to savings and earn monthly interest. "Save 200 → earn 10 more" makes it click.',
  },
  {
    icon: BookOpen,
    cardBg: 'bg-coin-soft',
    iconBg: 'bg-coin',
    iconColor: 'text-coin-ink',
    bodyColor: 'text-coin-ink',
    title: 'Reading streaks',
    body: 'Log minutes and books, build streaks, and turn "just five more minutes" into a habit.',
  },
  {
    icon: CalendarClock,
    cardBg: 'bg-ink-50',
    iconBg: 'bg-ink-800',
    iconColor: 'text-white',
    bodyColor: 'text-ink-700',
    title: 'Daily schedule',
    body: 'A per-kid timeline keeps mornings and homework on track without the nagging.',
  },
  {
    icon: Wallet,
    cardBg: 'bg-ink-50',
    iconBg: 'bg-ink-800',
    iconColor: 'text-white',
    bodyColor: 'text-ink-700',
    title: 'Wallet & history',
    body: 'Every earn and spend is logged, so kids see exactly where their loot came from and went.',
  },
];

export function Features() {
  return (
    <section id="features" className="bg-white">
      <div className="mx-auto max-w-[1180px] scroll-mt-24 px-5 py-14 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
        <Reveal>
          <div className="mx-auto max-w-[640px] text-center">
            <div className="font-sans text-[13px] font-extrabold uppercase tracking-wider text-orange">
              Features
            </div>
            <h2 className="mt-2.5 font-display text-[30px] font-extrabold leading-[1.08] tracking-tight text-ink-900 sm:text-[38px] lg:text-[46px]">
              Everything a growing money-brain needs
            </h2>
            <p className="mt-3.5 text-lg leading-relaxed text-ink-700">
              One playful app that covers earning, saving, spending, and the real-life skills in
              between.
            </p>
          </div>
        </Reveal>
        <div className="mt-11 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, cardBg, iconBg, iconColor, bodyColor, title, body }) => (
            <Reveal key={title}>
              <div className={`h-full rounded-card p-[26px] ${cardBg}`}>
                <span className={`inline-flex h-[52px] w-[52px] items-center justify-center rounded-[15px] ${iconBg}`}>
                  <Icon size={26} className={iconColor} />
                </span>
                <h3 className="mb-2 mt-4 font-display text-xl font-bold text-ink-900">{title}</h3>
                <p className={`text-[15px] leading-normal ${bodyColor}`}>{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
