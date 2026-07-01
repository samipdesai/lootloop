import Image from 'next/image';
import Link from 'next/link';
import { Wordmark } from '../../../../components/ui/Wordmark';

const APP_STORE_URL = 'https://apps.apple.com/app/id6783651693';

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3.5 font-display text-sm font-extrabold text-ink-900">{title}</div>
      <div className="flex flex-col gap-2.5 text-[15px] font-semibold">{children}</div>
    </div>
  );
}

const linkCls = 'text-ink-500 transition-colors hover:text-ink-900';

export function MarketingFooter() {
  return (
    <footer className="border-t border-ink-900/[0.06] bg-white">
      <div className="mx-auto max-w-[1180px] px-5 py-12 sm:px-8 lg:px-12 lg:py-16">
        <div className="flex flex-wrap justify-between gap-8">
          <div className="max-w-[300px]">
            <Link href="#top" className="mb-3.5 flex items-center gap-2.5">
              <Image src="/logomark.svg" alt="" width={34} height={34} />
              <Wordmark className="font-display text-xl font-extrabold text-ink-900" />
            </Link>
            <p className="text-[15px] leading-relaxed text-ink-500">
              Turning everyday good habits into real money skills kids actually enjoy building.
            </p>
          </div>
          <div className="flex flex-wrap gap-8 sm:gap-14 lg:gap-[72px]">
            <Column title="Product">
              <a href="#how-it-works" className={linkCls}>
                How it works
              </a>
              <a href="#features" className={linkCls}>
                Features
              </a>
              <a href="#faq" className={linkCls}>
                FAQ
              </a>
            </Column>
            <Column title="Company">
              <Link href="/privacy" className={linkCls}>
                Privacy
              </Link>
              <Link href="/terms" className={linkCls}>
                Terms
              </Link>
              <a href="mailto:support@lootloop.us" className={linkCls}>
                Support
              </a>
            </Column>
            <Column title="Get the app">
              <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className={linkCls}>
                iOS — App Store
              </a>
              <span className="text-ink-400">Android — coming soon</span>
            </Column>
          </div>
        </div>
        <div className="mt-9 flex flex-wrap justify-between gap-3 border-t border-ink-900/[0.06] pt-6 text-sm font-semibold text-ink-400">
          <span>© 2026 LootLoop. All rights reserved.</span>
          <span>Made for families who love a good habit.</span>
        </div>
      </div>
    </footer>
  );
}
