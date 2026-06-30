import { test, expect } from '@playwright/test';

// #56 — post-launch apex routing. After public launch, a logged-out visitor to
// the apex "/" is routed to /login (the parent app). Pre-launch this pointed at
// /coming-soon; that page still exists as a route but is no longer the apex face
// of lootloop.us. Guards the middleware redirect against silent regressions.
test.describe('apex routing (public launch)', () => {
  test('logged-out visitor to / lands on /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
  });

  test('/coming-soon still renders directly', async ({ page }) => {
    await page.goto('/coming-soon');
    await expect(page).toHaveURL(/\/coming-soon/);
    await expect(page.getByText(/coming soon/i)).toBeVisible();
  });
});
