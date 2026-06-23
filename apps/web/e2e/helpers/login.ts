import { expect, type Page } from '@playwright/test';

// Log a pre-seeded parent in through the real login form and land on the
// dashboard. Used by the chore-approval and reward specs (signup spec exercises
// the email-confirmation path instead).
export async function loginAsParent(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  // Password field by placeholder — getByLabel('Password') is ambiguous (the
  // show/hide button's aria-label also contains "Password").
  await page.getByPlaceholder('Your password').fill(password);
  await page.getByRole('button', { name: /log in/i }).click();
  // Middleware sends an onboarded parent to the dashboard home.
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
}
