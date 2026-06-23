import type { Metadata } from 'next';
import Link from 'next/link';
import { Brand } from '../../../components/ui/Brand';
import { EmailCapture } from './EmailCapture';

// LootLoop marketing "coming soon" page (M7 #55).
//
// ROUTING NOTE: this lives at /coming-soon (not the apex "/") on purpose.
// The dashboard already owns "/" via the (dashboard) route group, so a
// (marketing)/page.tsx would collide. Serving this at the apex of the public
// domain (lootloop.us root) — and deciding apex-vs-dashboard routing — is
// deferred to #56 (domain wiring). This route is allowlisted in middleware.ts
// so it renders publicly without auth.
export const metadata: Metadata = {
  title: 'LootLoop — Coming Soon',
  description: 'Family chores & rewards, looped. LootLoop is on its way.',
};

export default function ComingSoonPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 py-16">
      <div className="flex w-full max-w-[520px] flex-col items-center gap-8 text-center">
        <Brand size={112} celebrate />

        <div className="flex flex-col items-center gap-3">
          <h1 className="font-display text-[28px] font-extrabold leading-tight text-ink-900 sm:text-[34px]">
            Family chores &amp; rewards, looped.
          </h1>
          <p className="max-w-[440px] text-[17px] leading-relaxed text-ink-500">
            LootLoop turns everyday chores into points, savings, and real rewards
            the whole family can cheer for. We&apos;re putting on the finishing
            touches — sign up to hear when we launch.
          </p>
        </div>

        <span className="rounded-pill bg-coin-soft px-4 py-1.5 font-display text-sm font-bold text-coin-ink">
          Coming soon
        </span>

        <EmailCapture />
      </div>

      <footer className="mt-16 flex flex-col items-center gap-2 text-sm text-ink-400">
        <nav className="flex items-center gap-4">
          <Link href="/privacy" className="transition-colors hover:text-ink-700">
            Privacy Policy
          </Link>
          <span aria-hidden>&middot;</span>
          <Link href="/terms" className="transition-colors hover:text-ink-700">
            Terms of Service
          </Link>
        </nav>
        <p>&copy; {new Date().getFullYear()} LootLoop. All rights reserved.</p>
      </footer>
    </main>
  );
}
