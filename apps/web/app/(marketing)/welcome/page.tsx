import type { Metadata } from 'next';
import { MarketingNav } from './_components/MarketingNav';
import { Hero } from './_components/Hero';
import { HowItWorks } from './_components/HowItWorks';
import { Features } from './_components/Features';
import { ParentKidSplit } from './_components/ParentKidSplit';
import { Faq } from './_components/Faq';
import { FinalCta } from './_components/FinalCta';
import { MarketingFooter } from './_components/MarketingFooter';

// Public marketing homepage. Served at the apex "/" for logged-out visitors via a
// middleware rewrite (the URL stays "/"); also reachable directly at /welcome.
export const metadata: Metadata = {
  title: 'LootLoop — Turn everyday chores into missions kids love',
  description:
    'LootLoop turns chores and reading into loot kids earn, save, and spend — learning how money really works, while you stay in control with quick approvals.',
};

export default function WelcomePage() {
  return (
    <div className="overflow-x-hidden font-sans text-ink-700">
      <MarketingNav />
      <Hero />
      <HowItWorks />
      <Features />
      <ParentKidSplit />
      <Faq />
      <FinalCta />
      <MarketingFooter />
    </div>
  );
}
