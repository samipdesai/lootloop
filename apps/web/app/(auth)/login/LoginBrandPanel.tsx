import Image from 'next/image';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Coin } from '@/components/ui/Coin';

const PERKS = ['Set up chores in seconds', 'Approve & pay with one tap', 'Help them learn to save'];

// Orange brand panel — left half of the login split. Decorative + on-brand.
export function LoginBrandPanel() {
  return (
    <div className="relative flex min-h-[280px] flex-[1_1_460px] flex-col justify-between overflow-hidden bg-orange p-7 text-white sm:p-11 lg:min-h-screen">
      {/* decorative blobs */}
      <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/[0.09]" />
      <div className="absolute -bottom-16 -left-12 h-56 w-56 rounded-full bg-white/[0.07]" />
      {/* floating coins */}
      <div className="animate-float-coin absolute right-[12%] top-[16%] drop-shadow-[0_8px_14px_rgba(0,0,0,0.18)] [--coin-rot:-10deg]">
        <Coin size={46} />
      </div>
      <div
        className="animate-float-coin absolute right-[20%] top-[62%] drop-shadow-[0_8px_14px_rgba(0,0,0,0.18)] [--coin-rot:12deg]"
        style={{ animationDelay: '0.5s' }}
      >
        <Coin size={32} />
      </div>

      {/* logo */}
      <Link href="/" className="relative z-[2] flex w-fit items-center gap-2.5">
        <span className="inline-flex rounded-xl bg-white p-[5px]">
          <Image src="/logomark.svg" alt="" width={30} height={30} />
        </span>
        {/* Plain white wordmark — the two-tone orange "Loop" would vanish on the
            orange panel. */}
        <span className="font-display text-[22px] font-extrabold text-white">LootLoop</span>
      </Link>

      {/* headline + checklist */}
      <div className="relative z-[2] my-8 lg:my-11">
        <h1 className="max-w-[440px] font-display text-[30px] font-extrabold leading-tight tracking-tight sm:text-[38px] lg:text-[44px]">
          Your family&apos;s money HQ
        </h1>
        <p className="mt-4 max-w-[400px] text-base leading-relaxed opacity-90 sm:text-lg">
          Set chores, approve completions, and run the reward store — all from one calm dashboard.
        </p>
        <ul className="mt-7 flex flex-col gap-3.5">
          {PERKS.map(perk => (
            <li key={perk} className="flex items-center gap-3 text-base font-bold">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.22]">
                <Check size={16} className="text-white" />
              </span>
              {perk}
            </li>
          ))}
        </ul>
      </div>

      {/* mascot */}
      <div className="relative z-[2] flex items-end">
        <Image
          src="/looty.svg"
          alt=""
          width={112}
          height={112}
          className="animate-bob drop-shadow-[0_14px_22px_rgba(0,0,0,0.22)]"
        />
        <div className="mb-4 ml-3.5 rounded-[16px_16px_16px_4px] bg-white/[0.16] px-3.5 py-2.5 text-sm font-bold">
          Welcome back! 👋
        </div>
      </div>
    </div>
  );
}
