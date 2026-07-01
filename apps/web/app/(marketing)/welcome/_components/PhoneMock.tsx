import Image from 'next/image';
import {
  BatteryFull,
  BookOpen,
  Check,
  Dog,
  Flame,
  Gift,
  Lock,
  PiggyBank,
  Signal,
  Wifi,
} from 'lucide-react';
import { Coin } from '../../../../components/ui/Coin';

// Static iPhone mockup showing the kid home screen — the hero's product preview.
// Floating coins + approval card animate via CSS (animate-float-coin).
export function PhoneMock() {
  return (
    <div className="relative">
      {/* floating coins */}
      <div
        className="animate-float-coin absolute -left-6 -top-5 z-10 drop-shadow-[0_8px_14px_rgba(255,201,60,0.5)] [--coin-rot:-12deg]"
        style={{ animationDelay: '0s' }}
      >
        <Coin size={56} />
      </div>
      <div
        className="animate-float-coin absolute -right-7 bottom-16 z-10 drop-shadow-[0_8px_14px_rgba(255,201,60,0.5)] [--coin-rot:10deg]"
        style={{ animationDelay: '0.6s' }}
      >
        <Coin size={42} />
      </div>
      {/* approval card */}
      <div
        className="animate-float-coin absolute -right-11 top-28 z-10 flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 shadow-[0_20px_40px_-12px_rgba(33,30,39,0.35)]"
        style={{ animationDelay: '0.3s' }}
      >
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-mint-soft">
          <Check size={17} className="text-mint-strong" />
        </span>
        <div className="leading-tight">
          <div className="font-display text-sm font-extrabold text-ink-900">+25 loot</div>
          <div className="text-[11px] font-bold text-ink-500">chore approved</div>
        </div>
      </div>

      {/* phone body */}
      <div className="relative z-[2] w-[300px] rounded-[46px] bg-ink-900 p-3 shadow-[0_40px_80px_-20px_rgba(33,30,39,0.5)]">
        <div className="relative overflow-hidden rounded-[36px] bg-surface-page">
          {/* status bar */}
          <div className="flex items-center justify-between px-[22px] pb-1.5 pt-3 font-display text-[13px] font-bold text-ink-900">
            <span>9:41</span>
            <span className="-mt-1 h-[26px] w-24 rounded-full bg-ink-900" />
            <span className="inline-flex items-center gap-1.5">
              <Signal size={14} />
              <Wifi size={14} />
              <BatteryFull size={16} />
            </span>
          </div>

          {/* app content */}
          <div className="px-4 pb-[18px] pt-1">
            {/* header */}
            <div className="flex items-center gap-2.5 py-0.5 pb-3">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-extrabold uppercase tracking-wide text-ink-400">
                  Hi there
                </div>
                <div className="font-display text-[23px] font-extrabold leading-tight text-ink-900">
                  Maya 👋
                </div>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_2px_6px_rgba(33,30,39,0.08)]">
                <Lock size={16} className="text-ink-500" />
              </span>
              <Image
                src="/looty.svg"
                alt=""
                width={44}
                height={44}
                className="drop-shadow-[0_4px_8px_rgba(240,179,21,0.4)]"
              />
            </div>

            {/* wallet pill */}
            <div className="mb-3 flex flex-col gap-1 rounded-[26px] bg-orange px-[18px] py-[15px] text-white shadow-[0_6px_0_var(--color-orange-strong)]">
              <span className="text-[11px] font-extrabold uppercase tracking-wider opacity-85">
                Wallet
              </span>
              <div className="flex items-center gap-2.5">
                <Coin size={26} />
                <span className="font-display text-[34px] font-extrabold leading-none">1,240</span>
              </div>
            </div>

            {/* savings + store */}
            <div className="mb-3.5 flex gap-2.5">
              <div className="flex flex-1 items-center gap-2 rounded-[18px] bg-mint-soft p-3 shadow-[0_2px_6px_rgba(33,30,39,0.06)]">
                <PiggyBank size={24} className="shrink-0 text-mint-ink" />
                <div className="min-w-0">
                  <div className="text-[11px] font-extrabold text-mint-ink/80">Savings</div>
                  <span className="inline-flex items-center gap-1 font-display text-sm font-bold text-mint-ink">
                    <Coin size={15} />
                    320
                  </span>
                </div>
              </div>
              <div className="flex flex-1 items-center gap-2 rounded-[18px] bg-coin-soft p-3 shadow-[0_2px_6px_rgba(33,30,39,0.06)]">
                <Gift size={24} className="shrink-0 text-coin-ink" />
                <div className="min-w-0">
                  <div className="text-[11px] font-extrabold text-coin-ink/85">Store</div>
                  <div className="font-display text-[15px] font-extrabold text-coin-ink">
                    Spend loot
                  </div>
                </div>
              </div>
            </div>

            {/* streak */}
            <div className="mb-4 flex items-center gap-3 rounded-[22px] bg-orange-soft px-3.5 py-3.5 text-orange-ink">
              <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-orange shadow-[0_4px_10px_rgba(240,179,21,0.5)]">
                <Flame size={23} className="text-white" />
              </span>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-extrabold leading-none">4</span>
                  <span className="whitespace-nowrap text-[13px] font-bold">day streak</span>
                </div>
                <div className="flex gap-1.5">
                  {[0, 1, 2, 3, 4, 5, 6].map(i => (
                    <span
                      key={i}
                      className={`h-[11px] w-[11px] rounded-full ${i < 4 ? 'bg-orange' : 'bg-coin-strong/40'}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* chores */}
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display text-[17px] font-extrabold text-ink-900">
                Today&apos;s chores
              </span>
              <span className="text-xs font-extrabold text-ink-500">1/3 done</span>
            </div>
            <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full w-1/3 rounded-full bg-mint" />
            </div>
            <div className="flex flex-col gap-2.5">
              {[
                { icon: BookOpen, title: 'Read 20 minutes', pts: 30 },
                { icon: Dog, title: 'Feed the dog', pts: 10 },
              ].map(({ icon: Icon, title, pts }) => (
                <div
                  key={title}
                  className="flex items-center gap-3 rounded-[18px] bg-white p-3 shadow-[0_2px_6px_rgba(33,30,39,0.06)]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-indigo-soft">
                    <Icon size={21} className="text-indigo" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-extrabold text-ink-900">{title}</div>
                    <span className="inline-flex items-center gap-1 font-display text-[13px] font-bold text-ink-900">
                      <Coin size={14} />
                      {pts}
                    </span>
                  </div>
                  <span className="inline-flex h-8 items-center rounded-full bg-mint px-3.5 font-display text-[13px] font-bold text-white shadow-[0_3px_0_var(--color-mint-strong)]">
                    Done
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
