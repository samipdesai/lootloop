import Image from 'next/image';
import { Play } from 'lucide-react';
import { Coin } from '../../../../components/ui/Coin';
import { Reveal } from './Reveal';

const APP_STORE_URL = 'https://apps.apple.com/app/id6783651693';

function AppleMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.5 12.9c0-2 1.6-3 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.2 2-1.4 2.4-.4 6 1 8 .7 1 1.4 2 2.5 2 1 0 1.3-.6 2.5-.6 1.2 0 1.5.6 2.5.6 1.1 0 1.8-1 2.4-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2-.8-2-3.1zM14.6 6.2c.6-.7 1-1.6.9-2.5-.8 0-1.9.6-2.5 1.3-.5.6-1 1.5-.9 2.4.9.1 1.9-.5 2.5-1.2z" />
    </svg>
  );
}

export function FinalCta() {
  return (
    <section id="get" className="mx-auto max-w-[1180px] px-5 pb-14 sm:px-8 sm:pb-20 lg:px-12 lg:pb-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-2xl bg-ink-900 px-6 py-10 text-center sm:px-14 sm:py-16 lg:py-[72px]">
          <div className="animate-float-coin absolute -top-4 left-[8%] opacity-90">
            <Coin size={46} />
          </div>
          <div
            className="animate-float-coin absolute bottom-5 right-[10%] opacity-85 [--coin-rot:8deg]"
            style={{ animationDelay: '0.5s' }}
          >
            <Coin size={34} />
          </div>
          <Image src="/logomark.svg" alt="" width={60} height={60} className="mb-2 inline-block" />
          <h2 className="mt-2 font-display text-[30px] font-extrabold leading-[1.08] tracking-tight text-white sm:text-[40px] lg:text-[50px]">
            Start the loop today
          </h2>
          <p className="mx-auto mt-3.5 max-w-[480px] text-lg leading-relaxed text-white/80">
            Free for a limited time. Set up your first chores in minutes — no card required to start.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3.5">
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-14 items-center gap-2.5 rounded-pill bg-white px-6 text-ink-900 transition-transform active:translate-y-0.5"
            >
              <AppleMark />
              <span className="flex flex-col leading-none">
                <span className="text-[11px] font-semibold opacity-70">Download on the</span>
                <span className="font-display text-lg font-bold">App Store</span>
              </span>
            </a>
            <div className="inline-flex h-14 cursor-default items-center gap-2.5 rounded-pill border-2 border-dashed border-white/20 bg-white/[0.08] px-6 text-white/60">
              <Play size={20} fill="currentColor" />
              <span className="flex flex-col leading-tight">
                <span className="text-[11px] font-bold text-white/60">Coming soon</span>
                <span className="font-display text-lg font-bold text-white/85">Google Play</span>
              </span>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
