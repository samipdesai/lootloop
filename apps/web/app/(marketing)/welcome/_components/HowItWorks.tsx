import { BadgeCheck, HandCoins, ListTodo, PiggyBank } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Reveal } from './Reveal';

const STEPS: { icon: LucideIcon; iconBg: string; iconColor: string; title: string; body: string }[] =
  [
    {
      icon: ListTodo,
      iconBg: 'bg-orange-soft',
      iconColor: 'text-orange',
      title: 'Set up chores & rewards',
      body: 'Add tasks, reading goals, and a reward store. Pick what each one is worth in loot.',
    },
    {
      icon: HandCoins,
      iconBg: 'bg-coin-soft',
      iconColor: 'text-coin-strong',
      title: 'Kids complete & earn',
      body: 'They check off tasks and log reading right in the app, then watch their loot add up.',
    },
    {
      icon: BadgeCheck,
      iconBg: 'bg-mint-soft',
      iconColor: 'text-mint',
      title: 'You approve & pay',
      body: 'A quick tap approves the work and drops the loot into their wallet. Add bonuses anytime.',
    },
    {
      icon: PiggyBank,
      iconBg: 'bg-indigo-soft',
      iconColor: 'text-indigo',
      title: 'They save, spend & learn',
      body: 'Kids spend in the store or save — and earn interest, learning how money grows over time.',
    },
  ];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-[1180px] scroll-mt-24 px-5 py-14 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
      <Reveal>
        <div className="mx-auto mb-3 max-w-[640px] text-center">
          <div className="font-sans text-[13px] font-extrabold uppercase tracking-wider text-indigo">
            How it works
          </div>
          <h2 className="mt-2.5 font-display text-[30px] font-extrabold leading-[1.08] tracking-tight text-ink-900 sm:text-[38px] lg:text-[46px]">
            Four simple steps to happier habits
          </h2>
          <p className="mt-3.5 text-lg leading-relaxed text-ink-700">
            You set it up once. From there, the loop runs itself — kids earn, you approve, everyone
            wins.
          </p>
        </div>
      </Reveal>
      <div className="mt-11 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ icon: Icon, iconBg, iconColor, title, body }, i) => (
          <Reveal key={title}>
            <div className="relative h-full rounded-card bg-white p-[26px] shadow-[0_8px_20px_rgba(33,30,39,0.08)]">
              <span className="absolute right-6 top-[22px] font-display text-[40px] font-extrabold leading-none text-ink-100">
                {i + 1}
              </span>
              <span className={`inline-flex h-[54px] w-[54px] items-center justify-center rounded-2xl ${iconBg}`}>
                <Icon size={28} className={iconColor} />
              </span>
              <h3 className="mb-2 mt-[18px] font-display text-[21px] font-bold text-ink-900">
                {title}
              </h3>
              <p className="text-[15px] leading-normal text-ink-700">{body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
