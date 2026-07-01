import { Check, Sparkles, Users } from 'lucide-react';
import { Reveal } from './Reveal';

function Panel({
  variant,
  eyebrowIcon,
  eyebrow,
  title,
  body,
  items,
}: {
  variant: 'indigo' | 'orange';
  eyebrowIcon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  items: string[];
}) {
  const bg = variant === 'indigo' ? 'bg-indigo' : 'bg-orange';
  const blob = variant === 'indigo' ? 'bg-white/[0.08]' : 'bg-white/10';
  return (
    <Reveal className="h-full">
      <div className={`relative h-full overflow-hidden rounded-2xl p-7 text-white sm:p-11 ${bg}`}>
        <div className={`absolute -right-10 -top-10 h-40 w-40 rounded-full ${blob}`} />
        <span className="inline-flex items-center gap-2 rounded-pill bg-white/[0.18] px-3.5 py-1.5 text-[13px] font-extrabold">
          {eyebrowIcon}
          {eyebrow}
        </span>
        <h3 className="mb-3 mt-[18px] font-display text-2xl font-extrabold leading-tight sm:text-[32px]">
          {title}
        </h3>
        <p className="mb-[22px] max-w-[400px] text-base leading-relaxed opacity-95">{body}</p>
        <ul className="flex flex-col gap-3">
          {items.map(item => (
            <li key={item} className="flex items-center gap-3 text-[15px] font-bold">
              <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-white/25">
                <Check size={15} className="text-white" />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}

export function ParentKidSplit() {
  return (
    <section className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel
          variant="indigo"
          eyebrowIcon={<Users size={16} />}
          eyebrow="For parents"
          title="Full control, zero nagging"
          body="Set chores, approve completions, and run the reward store from your phone. Award bonus loot when they go above and beyond."
          items={[
            'One-tap approvals & payouts',
            'Manage multiple kids in one place',
            'Bonus loot & custom rewards',
          ]}
        />
        <Panel
          variant="orange"
          eyebrowIcon={<Sparkles size={16} />}
          eyebrow="For kids"
          title="Earning that feels like a game"
          body="Big balances, streaks, and coin-pop celebrations make good habits genuinely fun — with three age modes that grow with them."
          items={[
            'Celebrations on every win',
            'Simple, Detailed & Teen modes',
            'Watch savings actually grow',
          ]}
        />
      </div>
    </section>
  );
}
