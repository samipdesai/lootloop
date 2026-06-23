import type { Metadata } from 'next';
import Link from 'next/link';

// Terms of Service SCAFFOLD (M7 #53).
//
// ⚠️ DRAFT — pending legal review. The copy below is TEMPLATE/PLACEHOLDER text
// to give the structure for the user's lawyer to finalize. It is NOT legal
// advice and must not ship as-is. Public route, allowlisted in middleware.ts.
export const metadata: Metadata = {
  title: 'Terms of Service (Draft) — LootLoop',
  description: 'LootLoop terms of service — draft pending legal review.',
};

const LAST_UPDATED = 'June 22, 2026';

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-[760px] px-5 py-16">
      <div className="mb-8 rounded-card border-2 border-coin-strong bg-coin-soft px-5 py-4">
        <p className="font-display text-sm font-extrabold uppercase tracking-wide text-coin-ink">
          DRAFT — pending legal review (M7 #53)
        </p>
        <p className="mt-1 text-sm text-coin-ink">
          The text below is placeholder template copy for legal review. It is not
          legal advice and must not be relied upon until finalized.
        </p>
      </div>

      <h1 className="font-display text-[32px] font-extrabold leading-tight text-ink-900">
        Terms of Service
      </h1>
      <p className="mt-2 text-sm text-ink-500">Last updated: {LAST_UPDATED}</p>

      <div className="mt-8 flex flex-col gap-8 text-[16px] leading-relaxed text-ink-700">
        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            1. Acceptance of Terms
          </h2>
          <p className="mt-2">
            [PLACEHOLDER] These Terms of Service (&ldquo;Terms&rdquo;) govern your access
            to and use of the LootLoop family chore and reward application and related
            services (the &ldquo;Service&rdquo;). By creating an account or using the
            Service, you agree to these Terms. If you do not agree, do not use the
            Service.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            2. Eligibility &amp; Accounts
          </h2>
          <p className="mt-2">
            [PLACEHOLDER] You must be at least 18 years old and the parent or legal
            guardian of any child profile you create. You are responsible for
            maintaining the confidentiality of your account credentials and for all
            activity under your account, including activity by child profiles you
            manage.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            3. Family &amp; Child Profiles
          </h2>
          <p className="mt-2">
            [PLACEHOLDER — REQUIRES COUNSEL REVIEW.] Parents are responsible for the
            child profiles they create and for supervising their children&apos;s use of
            the Service. Points, rewards, and savings within the Service are
            in-app features for family motivation and have no monetary or cash value
            unless explicitly stated otherwise by the parent.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            4. Acceptable Use
          </h2>
          <p className="mt-2">[PLACEHOLDER] You agree not to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>Use the Service for any unlawful or fraudulent purpose.</li>
            <li>Attempt to access another family&apos;s data or bypass security controls.</li>
            <li>Interfere with or disrupt the integrity or performance of the Service.</li>
            <li>Reverse engineer or misuse the Service except as permitted by law.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            5. Subscriptions &amp; Payments
          </h2>
          <p className="mt-2">
            [PLACEHOLDER] If the Service offers paid plans, applicable fees, billing
            cycles, and cancellation terms will be presented at the time of purchase.
            Charges are processed through the applicable app store or payment provider
            and are subject to their terms.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            6. Intellectual Property
          </h2>
          <p className="mt-2">
            [PLACEHOLDER] The Service, including its software, design, and branding, is
            owned by LootLoop and protected by intellectual property laws. We grant you
            a limited, non-exclusive, non-transferable license to use the Service for
            your family&apos;s personal, non-commercial use.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            7. Termination
          </h2>
          <p className="mt-2">
            [PLACEHOLDER] You may stop using the Service and delete your account at any
            time. We may suspend or terminate access if you violate these Terms or to
            protect the Service or other users.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            8. Disclaimers &amp; Limitation of Liability
          </h2>
          <p className="mt-2">
            [PLACEHOLDER — REQUIRES COUNSEL REVIEW.] The Service is provided &ldquo;as
            is&rdquo; without warranties of any kind. To the maximum extent permitted by
            law, LootLoop is not liable for indirect, incidental, or consequential
            damages arising from your use of the Service.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            9. Changes to These Terms
          </h2>
          <p className="mt-2">
            [PLACEHOLDER] We may update these Terms from time to time. We will post the
            updated version with a revised &ldquo;Last updated&rdquo; date and, where
            appropriate, notify you. Continued use after changes constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            10. Contact Us
          </h2>
          <p className="mt-2">
            [PLACEHOLDER] Questions about these Terms? Contact us at{' '}
            <span className="font-semibold text-ink-900">support@lootloop.us</span>.
          </p>
        </section>
      </div>

      <div className="mt-12 border-t border-border pt-6 text-sm text-ink-500">
        <Link href="/coming-soon" className="transition-colors hover:text-ink-900">
          &larr; Back to LootLoop
        </Link>
        <span className="px-2" aria-hidden>
          &middot;
        </span>
        <Link href="/privacy" className="transition-colors hover:text-ink-900">
          Privacy Policy
        </Link>
      </div>
    </main>
  );
}
