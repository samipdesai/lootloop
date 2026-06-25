import type { Metadata } from 'next';
import Link from 'next/link';
import { Wordmark } from '../../../components/ui/Wordmark';

// Terms of Service (M7 #53).
//
// Real, substantive copy matching how LootLoop actually works — not placeholder
// text. Not a substitute for review by a qualified attorney; a one-time
// professional review is still recommended. Public route, allowlisted in
// middleware.ts.
export const metadata: Metadata = {
  title: 'Terms of Service — LootLoop',
  description: 'The terms that govern your use of LootLoop.',
};

const LAST_UPDATED = 'June 24, 2026';

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-[760px] px-5 py-16">
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
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of
            the LootLoop family chore and reward application and related services (the
            &ldquo;Service&rdquo;). By creating an account or using the Service, you agree
            to these Terms and to our{' '}
            <Link href="/privacy" className="font-semibold text-ink-900 underline">
              Privacy Policy
            </Link>
            . If you do not agree, please do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            2. Eligibility &amp; Accounts
          </h2>
          <p className="mt-2">
            You must be at least 18 years old and the parent or legal guardian of any
            child profile you create. You are responsible for keeping your account
            credentials confidential and for all activity under your account, including
            activity by the child profiles you create and manage. Children use the Service
            only through profiles created and supervised by their parent or guardian; they
            do not have independent accounts.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            3. Family &amp; Child Profiles
          </h2>
          <p className="mt-2">
            You are responsible for the child profiles you create and for supervising your
            children&apos;s use of the Service. Points, rewards, streaks, and savings
            within LootLoop are in-app features intended to motivate and reward children
            within your family. They are not currency, have no monetary or cash value, and
            cannot be exchanged, transferred, or redeemed for money. Any real-world reward
            a parent chooses to associate with in-app points is solely a matter between the
            parent and child and is not provided, guaranteed, or fulfilled by LootLoop.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">4. Acceptable Use</h2>
          <p className="mt-2">You agree not to:</p>
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
            LootLoop may offer optional paid features or subscriptions. If it does, the
            applicable price, billing cycle, and cancellation terms will be shown to you
            before you purchase. Any charges are processed by the applicable app store
            (for example, Apple) under that store&apos;s terms, and subscriptions renew and
            can be cancelled through your app store account. Features available for free
            today may change in the future.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            6. Intellectual Property
          </h2>
          <p className="mt-2">
            The Service — including its software, design, and branding — is owned by
            LootLoop and protected by intellectual-property laws. We grant you a limited,
            non-exclusive, non-transferable license to use the Service for your
            family&apos;s personal, non-commercial use. The data you and your family enter
            remains yours; you grant us only the permissions needed to store and process it
            to provide the Service, as described in our Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">7. Termination</h2>
          <p className="mt-2">
            You may stop using the Service and delete your account at any time from within
            the app (Settings → Account). We may suspend or terminate access if you violate
            these Terms or to protect the Service or other users. On account deletion, your
            family&apos;s data is removed as described in our Privacy Policy.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            8. Disclaimers &amp; Limitation of Liability
          </h2>
          <p className="mt-2">
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;
            without warranties of any kind, whether express or implied. To the maximum
            extent permitted by law, LootLoop will not be liable for any indirect,
            incidental, special, consequential, or punitive damages, or for any loss of
            data, arising from or relating to your use of the Service. Some jurisdictions
            do not allow certain limitations, so some of the above may not apply to you.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            9. Changes to These Terms
          </h2>
          <p className="mt-2">
            We may update these Terms from time to time. We will post the updated version
            here with a revised &ldquo;Last updated&rdquo; date and, where appropriate,
            notify you. Your continued use of the Service after an update means you accept
            the revised Terms.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">10. Contact Us</h2>
          <p className="mt-2">
            Questions about these Terms? Contact us at{' '}
            <span className="font-semibold text-ink-900">support@lootloop.us</span>.
          </p>
        </section>
      </div>

      <div className="mt-12 border-t border-border pt-6 text-sm text-ink-500">
        <Link href="/coming-soon" className="transition-colors hover:text-ink-900">
          &larr; Back to <Wordmark />
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
