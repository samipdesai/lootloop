import { test, expect } from '@playwright/test';

// #56 — pre-launch apex routing. A logged-out visitor to the apex "/" is routed
// to the public coming-soon page, while the parent app stays reachable at /login.
// Guards the middleware redirect so a future change can't silently expose the
// dashboard or login form as the face of lootloop.us before launch.
test.describe('coming-soon apex routing', () => {
  test('logged-out visitor to / lands on coming-soon', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/coming-soon/);
    await expect(page.getByRole('heading', { name: /looped/i })).toBeVisible();
    await expect(page.getByText(/coming soon/i)).toBeVisible();
  });

  test('/login stays reachable directly', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
  });
});
