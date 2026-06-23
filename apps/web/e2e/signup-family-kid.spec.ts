import { test, expect } from '@playwright/test';
import { fetchConfirmationLink, deleteMailFor } from './helpers/auth';
import { sql } from './helpers/db';

// Golden path 1: signup → confirm email → create family → add kid.
//
// Exercises the REAL email-confirmation flow: the signup form is driven in the
// browser (so @supabase/ssr's PKCE code verifier is stored), Mailpit yields the
// emailed verify link, and visiting it in the SAME browser context lets
// /auth/callback exchange the ?code for a session → onboarding → dashboard.

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

test.describe('signup → create family → add kid', () => {
  // Unique per run so the spec is idempotent (no leftover email/family clash).
  const token = `${Date.now()}`;
  const email = `e2e-signup-${token}@lootloop.test`;
  const password = 'E2eTest1234!';
  const familyName = `E2E Signup Family ${token}`;
  const kidName = 'Riley';

  test.afterAll(async () => {
    // Clean the auth user + family this spec created so re-runs stay clean.
    sql(`delete from families where name = '${esc(familyName)}';`);
    sql(`delete from auth.users where email = '${esc(email)}';`);
    await deleteMailFor(email);
  });

  test('confirms email, creates a family, and adds a kid', async ({ page }) => {
    await deleteMailFor(email);

    // 1) Sign up through the real form.
    await page.goto('/signup');
    await page.getByLabel('Email').fill(email);
    // Password by placeholder (getByLabel('Password') is ambiguous: the
    // show/hide button's aria-label also contains "Password").
    await page.getByPlaceholder('Create a password').fill(password);
    await page.getByRole('button', { name: /create account/i }).click();

    // Lands on the "Check your email" screen.
    await expect(page.getByRole('heading', { name: /check your email/i })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    // 2) Retrieve + visit the confirmation link (same context → /auth/callback
    // exchanges the PKCE code and sets the session cookie on 127.0.0.1).
    const link = await fetchConfirmationLink(email);
    await page.goto(link);

    // The Next dev server's internal origin is `localhost`, so the callback's
    // post-exchange redirect bounces to localhost (where the 127.0.0.1-scoped
    // session cookie isn't sent). Re-enter on the canonical 127.0.0.1 host: the
    // session cookie is read and middleware routes the confirmed-but-not-yet-
    // onboarded user to /onboarding.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /you're in/i })).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding/);

    // 3) Create a family.
    await page.getByLabel('Your name').fill('Sam');
    await page.getByLabel('Family name').fill(familyName);
    await page.getByRole('button', { name: /create family/i }).click();

    // Lands on the dashboard; header shows the new family name.
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByText(familyName, { exact: true })).toBeVisible();

    // 4) Add a kid.
    await page.getByRole('link', { name: 'Kids' }).first().click();
    await expect(page.getByRole('heading', { name: 'Kids' })).toBeVisible();

    await page.getByRole('button', { name: /add (your first )?kid/i })
      .first()
      .click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Add kid' })).toBeVisible();
    await dialog.getByLabel('Name').fill(kidName);
    await dialog.getByLabel('PIN').fill('1234');
    await dialog.getByRole('button', { name: 'Add kid' }).click();

    // The new kid appears in the roster.
    await expect(page.getByText(kidName, { exact: true })).toBeVisible();
  });
});
