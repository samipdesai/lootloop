import type { Metadata } from 'next';
import Link from 'next/link';

// Privacy Policy SCAFFOLD (M7 #53).
//
// ⚠️ DRAFT — pending legal review. The copy below is TEMPLATE/PLACEHOLDER text
// to give the structure for the user's lawyer to finalize. It is NOT legal
// advice and must not ship as-is. Public route, allowlisted in middleware.ts.
export const metadata: Metadata = {
  title: 'Privacy Policy (Draft) — LootLoop',
  description: 'LootLoop privacy policy — draft pending legal review.',
};

const LAST_UPDATED = 'June 22, 2026';

export default function PrivacyPage() {
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
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-ink-500">Last updated: {LAST_UPDATED}</p>

      <div className="mt-8 flex flex-col gap-8 text-[16px] leading-relaxed text-ink-700">
        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">1. Introduction</h2>
          <p className="mt-2">
            [PLACEHOLDER] This Privacy Policy explains how LootLoop (&ldquo;we&rdquo;,
            &ldquo;us&rdquo;, &ldquo;our&rdquo;) collects, uses, and protects
            information when you and your family use the LootLoop family chore and
            reward application and related services (the &ldquo;Service&rdquo;). By
            using the Service you agree to the practices described here.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            2. Information We Collect
          </h2>
          <p className="mt-2">[PLACEHOLDER] We collect the following categories of data:</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <strong>Account information</strong> — parent email address, name, and
              authentication credentials.
            </li>
            <li>
              <strong>Family &amp; child profiles</strong> — child display names,
              ages/age-mode, and avatars created by the parent.
            </li>
            <li>
              <strong>App activity</strong> — chores, points, rewards, savings, and
              reading activity recorded as part of normal use.
            </li>
            <li>
              <strong>Device &amp; technical data</strong> — device identifiers, app
              version, and diagnostic logs.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            3. How We Use Information
          </h2>
          <p className="mt-2">
            [PLACEHOLDER] We use information to operate and provide the Service,
            authenticate users, sync family data across devices, improve and secure
            the product, and communicate important account or service updates. We do
            not sell personal information.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            4. Children&apos;s Data &amp; Parental Consent
          </h2>
          <p className="mt-2">
            [PLACEHOLDER — REQUIRES COUNSEL REVIEW: COPPA / GDPR-K obligations.]
            LootLoop is designed for family use under the supervision of a parent or
            legal guardian. Child profiles are created and controlled by a parent
            account. We collect children&apos;s information only as directed by the
            supervising parent and only to provide the Service. A parent may review,
            edit, or delete a child&apos;s information at any time from the parent
            account. We do not knowingly collect personal information directly from
            children outside of the parent-managed experience.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            5. How We Share Information
          </h2>
          <p className="mt-2">
            [PLACEHOLDER] We share information only with service providers who help us
            operate the Service (for example, cloud hosting and authentication
            infrastructure) under contractual confidentiality obligations, or where
            required by law. Family data is isolated per family and is not shared with
            other families.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            6. Data Retention &amp; Deletion
          </h2>
          <p className="mt-2">
            [PLACEHOLDER] We retain personal information for as long as your account is
            active or as needed to provide the Service. You may request deletion of
            your account and associated family data; upon deletion we will remove or
            anonymize personal information except where retention is required by law.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            7. Security
          </h2>
          <p className="mt-2">
            [PLACEHOLDER] We use technical and organizational measures designed to
            protect personal information, including encryption in transit and
            family-level data isolation. No method of transmission or storage is
            completely secure.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            8. Your Rights
          </h2>
          <p className="mt-2">
            [PLACEHOLDER] Depending on your jurisdiction, you may have rights to
            access, correct, delete, or export your personal information, and to
            object to or restrict certain processing. Contact us to exercise these
            rights.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            9. Changes to This Policy
          </h2>
          <p className="mt-2">
            [PLACEHOLDER] We may update this Privacy Policy from time to time. We will
            post the updated version with a revised &ldquo;Last updated&rdquo; date and,
            where appropriate, notify you.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            10. Contact Us
          </h2>
          <p className="mt-2">
            [PLACEHOLDER] Questions about this Privacy Policy? Contact us at{' '}
            <span className="font-semibold text-ink-900">privacy@lootloop.us</span>.
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
        <Link href="/terms" className="transition-colors hover:text-ink-900">
          Terms of Service
        </Link>
      </div>
    </main>
  );
}
