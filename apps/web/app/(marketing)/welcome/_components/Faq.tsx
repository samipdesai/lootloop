'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Copy corrected to match the live product (ages 5–15; iOS now, Android soon).
const FAQS = [
  {
    q: 'Is LootLoop free?',
    a: 'LootLoop is free for a limited time, with everything unlocked and no card needed to start. After that it’s one simple subscription that covers every kid in your family.',
  },
  {
    q: 'What ages is it for?',
    a: 'It’s built for kids and teens aged 5–15. Three age modes — Simple (5–8), Detailed (9–12), and Teen (13–15) — adjust the interface and money concepts so it grows with your child.',
  },
  {
    q: 'Does it use real money?',
    a: 'No. Kids earn points called “loot,” not cash. You decide what loot is worth and fulfill rewards yourself — so there’s no gambling, no spending, and no pressure.',
  },
  {
    q: 'Can I add more than one child?',
    a: 'Yes. Manage as many kids as you like from one parent account, each with their own chores, wallet, savings, and age mode.',
  },
  {
    q: 'Is my family’s data safe?',
    a: 'Kid accounts are private and parent-controlled. There are no ads and no third-party selling of data — LootLoop is designed to be a safe, calm space for families.',
  },
  {
    q: 'Which devices does it work on?',
    a: 'LootLoop is on iPhone and iPad today, with Android coming soon. Parents and kids can each use their own device, and everything stays in sync.',
  },
];

export function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="mx-auto max-w-[820px] scroll-mt-24 px-5 py-14 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
      <div className="mb-10 text-center">
        <div className="font-sans text-[13px] font-extrabold uppercase tracking-wider text-indigo">
          FAQ
        </div>
        <h2 className="mt-2.5 font-display text-[30px] font-extrabold leading-[1.08] tracking-tight text-ink-900 sm:text-[38px] lg:text-[46px]">
          Questions, answered
        </h2>
      </div>
      <div className="flex flex-col gap-3">
        {FAQS.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q} className="overflow-hidden rounded-lg bg-white shadow-[0_2px_6px_rgba(33,30,39,0.06)]">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? -1 : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 px-[22px] py-5 text-left font-display text-base font-bold text-ink-900 sm:text-[19px]"
              >
                <span>{f.q}</span>
                <span
                  className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full transition-transform duration-300 ${isOpen ? 'rotate-180 bg-indigo-soft' : 'bg-ink-100'}`}
                >
                  <ChevronDown size={18} className={isOpen ? 'text-indigo' : 'text-ink-500'} />
                </span>
              </button>
              {isOpen && (
                <div className="px-[22px] pb-[22px] text-base leading-relaxed text-ink-700">
                  {f.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
