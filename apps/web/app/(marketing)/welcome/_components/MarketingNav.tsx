'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Wordmark } from '../../../../components/ui/Wordmark';

const LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#faq', label: 'FAQ' },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-ink-900/[0.06] bg-surface-page/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-[1180px] items-center justify-between gap-6 px-5 py-3.5 sm:px-8 lg:px-12">
        <Link href="#top" className="flex items-center gap-2.5" aria-label="LootLoop home">
          <Image src="/logomark.svg" alt="" width={38} height={38} priority />
          <Wordmark className="font-display text-[22px] font-extrabold tracking-tight text-ink-900" />
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-7 md:flex">
          <div className="flex items-center gap-7 font-sans text-[15px] font-bold text-ink-700">
            {LINKS.map(l => (
              <a key={l.href} href={l.href} className="transition-colors hover:text-ink-900">
                {l.label}
              </a>
            ))}
          </div>
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-pill bg-orange px-5 font-display text-[15px] font-bold text-white shadow-[0_4px_0_var(--color-orange-strong)] transition-transform active:translate-y-0.5"
          >
            Log in
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-900 md:hidden"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-ink-900/[0.06] bg-surface-page px-5 pb-5 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map(l => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-3 font-sans text-base font-bold text-ink-700"
              >
                {l.label}
              </a>
            ))}
            <Link
              href="/login"
              className="mt-2 inline-flex h-12 items-center justify-center rounded-pill bg-orange px-5 font-display text-base font-bold text-white shadow-[0_4px_0_var(--color-orange-strong)]"
            >
              Log in
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
