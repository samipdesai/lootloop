import { Play } from 'lucide-react';
import { Coin } from '../../../../components/ui/Coin';
import { PhoneMock } from './PhoneMock';
import { Reveal } from './Reveal';

const APP_STORE_URL = 'https://apps.apple.com/app/id6783651693';

// Apple logo (Lucide has no brand marks).
function AppleMark({ className }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M16.5 12.9c0-2 1.6-3 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.2 2-1.4 2.4-.4 6 1 8 .7 1 1.4 2 2.5 2 1 0 1.3-.6 2.5-.6 1.2 0 1.5.6 2.5.6 1.1 0 1.8-1 2.4-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2-.8-2-3.1zM14.6 6.2c.6-.7 1-1.6.9-2.5-.8 0-1.9.6-2.5 1.3-.5.6-1 1.5-.9 2.4.9.1 1.9-.5 2.5-1.2z" />
    </svg>
  );
}

export function Hero() {
  return (
    <section
      id="top"
      className="relative mx-auto flex max-w-[1180px] flex-wrap items-center gap-8 px-5 py-10 sm:px-8 sm:py-14 lg:gap-16 lg:px-12 lg:py-20"
    >
      <div className="min-w-[300px] flex-[1_1_440px]">
        <Reveal>
          <div className="inline-flex items-center gap-2 rounded-pill bg-coin-soft py-[7px] pl-2.5 pr-3.5 text-[13px] font-extrabold tracking-wide text-coin-ink">
            <Coin size={18} />
            Chores that pay off — in real money skills
          </div>
        </Reveal>
        <Reveal>
          <h1 className="mt-4 font-display text-[38px] font-extrabold leading-[1.04] tracking-tight text-ink-900 sm:text-[48px] lg:text-[60px]">
            Turn everyday chores into <span className="text-orange">missions kids love</span>
          </h1>
        </Reveal>
        <Reveal>
          <p className="mt-5 max-w-[520px] text-[17px] leading-relaxed text-ink-700 sm:text-lg lg:text-xl">
            Kids do chores and reading, earn <strong className="text-ink-900">loot</strong>, then
            save, spend, and watch it grow — learning how money really works. You stay in control
            with quick approvals.
          </p>
        </Reveal>
        <Reveal>
          <div className="mt-7 flex flex-wrap gap-3.5">
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-14 items-center gap-2.5 rounded-pill bg-ink-900 px-[22px] text-white transition-transform active:translate-y-0.5"
            >
              <AppleMark />
              <span className="flex flex-col leading-none">
                <span className="text-[11px] font-semibold opacity-80">Download on the</span>
                <span className="font-display text-lg font-bold">App Store</span>
              </span>
            </a>
            <div className="inline-flex h-14 cursor-default items-center gap-2.5 rounded-pill border-2 border-dashed border-ink-300 bg-ink-100 px-[22px] text-ink-500">
              <Play size={20} className="opacity-70" fill="currentColor" />
              <span className="flex flex-col leading-tight">
                <span className="text-[11px] font-bold text-ink-400">Coming soon</span>
                <span className="font-display text-lg font-bold text-ink-700">Google Play</span>
              </span>
            </div>
          </div>
        </Reveal>
      </div>

      <div className="flex min-w-[300px] flex-[1_1_340px] justify-center">
        <Reveal>
          <PhoneMock />
        </Reveal>
      </div>
    </section>
  );
}
