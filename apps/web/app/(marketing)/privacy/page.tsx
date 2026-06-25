import type { Metadata } from 'next';
import Link from 'next/link';
import { Wordmark } from '../../../components/ui/Wordmark';

// Privacy Policy (M7 #53).
//
// This is REAL, substantive copy written to match LootLoop's actual data
// practices (see docs/compliance/coppa-kids-data-review.md) — not placeholder
// text. It is not a substitute for review by a qualified privacy attorney; a
// one-time professional review is still recommended before relying on it for a
// children's product. Keep it in sync with the COPPA review if data practices
// change. Public route, allowlisted in middleware.ts.
export const metadata: Metadata = {
  title: 'Privacy Policy — LootLoop',
  description: 'How LootLoop collects, uses, and protects family and children’s data.',
};

const LAST_UPDATED = 'June 24, 2026';

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[760px] px-5 py-16">
      <h1 className="font-display text-[32px] font-extrabold leading-tight text-ink-900">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-ink-500">Last updated: {LAST_UPDATED}</p>

      <div className="mt-8 flex flex-col gap-8 text-[16px] leading-relaxed text-ink-700">
        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">1. Introduction</h2>
          <p className="mt-2">
            LootLoop (&ldquo;LootLoop,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
            &ldquo;our&rdquo;) is a family chore and reward app. A parent or legal
            guardian creates a family account and sets up profiles for their children,
            who can then complete chores, earn and spend points, save toward goals, and
            log reading. This Privacy Policy explains what information we collect, how we
            use and protect it, and the choices and rights you have. Because LootLoop is
            designed for families with children, we have built it to collect as little
            information as possible and to keep that information private to your family.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            2. Information We Collect
          </h2>
          <p className="mt-2">
            We collect only what is needed to run the app for your family:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <strong>Parent account information</strong> — the parent&apos;s email
              address (used to sign in and to confirm the account), a display name, and
              an authentication password (stored only in hashed form by our
              authentication provider).
            </li>
            <li>
              <strong>Children&apos;s profile information</strong> — a display name the
              parent chooses (a first name or nickname is encouraged), an age
              <em> mode</em> (an age band such as 5–8, 9–12, or 13–15 that controls how
              the interface looks — not a date of birth), an optional avatar, and a
              numeric PIN the child uses to sign in on the family&apos;s device. PINs are
              stored only as a secure hash, never in plain text.
            </li>
            <li>
              <strong>App activity</strong> — chores, point and savings balances and
              their transaction history, reward purchases, reading logs (book title,
              minutes, date), and schedule items. This is the data the app exists to
              track.
            </li>
            <li>
              <strong>Diagnostic data</strong> — if the app encounters an error or
              crash, we collect technical diagnostics (error type, a code stack trace,
              app version, and device model) to fix problems. These crash reports are
              configured to <strong>exclude</strong> names, PINs, balances, IP
              addresses, and any other personal information.
            </li>
          </ul>
          <p className="mt-2">
            We do <strong>not</strong> collect children&apos;s contact information, precise
            location, or photos beyond an optional parent-chosen avatar, and there is no
            chat, messaging, or public profile in LootLoop.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            3. How We Use Information
          </h2>
          <p className="mt-2">
            We use information solely to provide and operate the Service: to
            authenticate accounts, sync your family&apos;s data across devices, run the
            chore/points/rewards/savings/reading features, send essential account emails
            (such as sign-up confirmation and password resets), and diagnose and fix
            technical problems. We do <strong>not</strong> use your or your
            children&apos;s information for advertising or marketing, we do{' '}
            <strong>not</strong> sell or rent it, and we do <strong>not</strong> use
            third-party advertising or analytics tracking.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            4. Children&apos;s Data &amp; Parental Consent (COPPA)
          </h2>
          <p className="mt-2">
            LootLoop is intended to be used by children under the supervision of a parent
            or legal guardian, and we comply with the U.S. Children&apos;s Online Privacy
            Protection Act (COPPA).
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <strong>Children cannot sign up on their own.</strong> Only a parent can
              create the family account and each child profile. All of a child&apos;s
              information is entered and controlled by the parent.
            </li>
            <li>
              <strong>Consent.</strong> By creating a family account and adding a child
              profile, the parent provides consent for us to collect and use that
              child&apos;s information as described in this policy, solely to provide the
              Service.
            </li>
            <li>
              <strong>Parental rights.</strong> A parent can, at any time, review their
              child&apos;s information in the app, correct it, stop further collection by
              removing the child&apos;s profile, and delete the child&apos;s data or the
              entire family account (see Section 6). To exercise any of these rights you
              can also contact us at{' '}
              <span className="font-semibold text-ink-900">privacy@lootloop.us</span>.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            5. How We Share Information
          </h2>
          <p className="mt-2">
            We do not sell or share your family&apos;s information with third parties for
            their own purposes. We use a small number of trusted service providers who
            process data only on our behalf and under confidentiality obligations, solely
            to operate the Service:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <strong>Supabase</strong> — secure database, authentication, and backend
              hosting (stores your family&apos;s account and app data).
            </li>
            <li>
              <strong>Vercel</strong> — hosting for the LootLoop web app.
            </li>
            <li>
              <strong>Resend</strong> — delivery of essential account emails (e.g.
              sign-up confirmation, password reset) to the parent&apos;s email address.
            </li>
            <li>
              <strong>Sentry</strong> — error and crash diagnostics, configured to
              exclude personal information as described in Section 2.
            </li>
          </ul>
          <p className="mt-2">
            We may also disclose information if required by law or to protect the rights,
            safety, and security of our users or the Service. Your family&apos;s data is
            isolated per family and is never shared with other families.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            6. Data Retention &amp; Deletion
          </h2>
          <p className="mt-2">
            We keep your information for as long as your account is active. You can delete
            an individual child&apos;s profile, or your entire family account, from within
            the app (Settings → Account), or by contacting us at{' '}
            <span className="font-semibold text-ink-900">privacy@lootloop.us</span>.
            Deleting a family permanently removes the family&apos;s profiles and all
            associated app data from our active systems immediately. Residual copies may
            persist in encrypted backups for a limited period before being overwritten,
            after which they are permanently gone.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">7. Security</h2>
          <p className="mt-2">
            We use technical and organizational measures to protect your information,
            including encryption in transit, hashing of authentication passwords and
            child PINs, and database-level access controls that isolate each
            family&apos;s data from every other family. No method of transmission or
            storage is completely secure, but we work to protect your information using
            industry-standard practices.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">8. Your Rights</h2>
          <p className="mt-2">
            You may access, correct, export, or delete your and your children&apos;s
            information at any time, and you may withdraw consent by deleting a child
            profile or your account. Depending on where you live, you may have additional
            rights under applicable privacy laws. To make a request, use the in-app
            controls or contact us at{' '}
            <span className="font-semibold text-ink-900">privacy@lootloop.us</span>.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">
            9. Changes to This Policy
          </h2>
          <p className="mt-2">
            We may update this Privacy Policy from time to time. When we do, we will post
            the updated version here with a revised &ldquo;Last updated&rdquo; date and,
            where appropriate, notify you. Your continued use of the Service after an
            update means you accept the revised policy.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-bold text-ink-900">10. Contact Us</h2>
          <p className="mt-2">
            If you have any questions about this Privacy Policy or your family&apos;s
            data, contact us at{' '}
            <span className="font-semibold text-ink-900">privacy@lootloop.us</span>.
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
        <Link href="/terms" className="transition-colors hover:text-ink-900">
          Terms of Service
        </Link>
      </div>
    </main>
  );
}
