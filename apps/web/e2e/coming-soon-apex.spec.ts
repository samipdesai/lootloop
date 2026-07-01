import { test, expect } from '@playwright/test';

// Apex routing. A logged-out visitor to "/" is served the marketing homepage via
// a middleware rewrite — the URL stays "/" (no redirect). The old /coming-soon
// page still exists as a standalone route but is no longer the apex. Guards the
// middleware against silent regressions.
test.describe('apex marketing routing', () => {
  test('logged-out visitor to / sees the marketing homepage (URL stays /)', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /missions kids love/i })).toBeVisible();
    // The nav "Log in" links to the auth page.
    await expect(page.getByRole('link', { name: /log in/i }).first()).toBeVisible();
  });

  test('/coming-soon still renders directly', async ({ page }) => {
    await page.goto('/coming-soon');
    await expect(page).toHaveURL(/\/coming-soon/);
    await expect(page.getByText(/coming soon/i)).toBeVisible();
  });
});
