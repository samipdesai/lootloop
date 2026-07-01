import { test, expect } from '@playwright/test';
import { loginAsParent } from './helpers/login';
import {
  seedFamilyWithParentAndKid,
  seedPurchasedReward,
  teardownFamily,
  type SeededFamily,
} from './helpers/seed';

// Golden path 3: reward CRUD → fulfillment.
//
// The parent creates a reward, edits it, and deletes it (full CRUD) in the
// Rewards → Store tab. Then, because a kid purchase can't happen on web, a
// purchased reward is seeded via SQL; the parent fulfills it ("Mark as given")
// in the Rewards → Fulfillment tab and the row drops from the queue.

test.describe('reward CRUD → fulfillment', () => {
  let family: SeededFamily;
  const token = `${Date.now()}`;
  const createTitle = `E2E Reward ${token}`;
  const editedTitle = `E2E Reward ${token} (edited)`;
  const purchasedTitle = `Ice cream ${token}`;

  test.beforeAll(async () => {
    family = await seedFamilyWithParentAndKid({ token: `r${token}`, kidName: 'Leo' });
  });

  test.afterAll(async () => {
    await teardownFamily(family);
  });

  test('creates, edits, deletes a reward, then fulfills a purchase', async ({ page }) => {
    await loginAsParent(page, family.parent.email, family.parent.password);

    await page.getByRole('link', { name: 'Rewards' }).first().click();
    await expect(page.getByRole('heading', { name: 'Rewards' })).toBeVisible();

    // --- CREATE ---
    await page
      .getByRole('button', { name: /add (your first )?reward/i })
      .first()
      .click();
    let dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Add reward')).toBeVisible();
    await dialog.getByLabel('Title').fill(createTitle);
    await dialog.getByLabel('Cost').fill('120');
    await dialog.getByRole('button', { name: 'Create reward' }).click();
    await expect(page.getByText(createTitle, { exact: true })).toBeVisible();

    // --- EDIT --- (the reward card is the one .rounded-card tile bearing the title)
    const card = page.locator('.rounded-card', { hasText: createTitle });
    await card.getByRole('button', { name: 'Edit' }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Edit reward')).toBeVisible();
    await dialog.getByLabel('Title').fill(editedTitle);
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText(editedTitle, { exact: true })).toBeVisible();

    // --- DELETE --- (window.confirm → accept)
    page.once('dialog', d => d.accept());
    const editedCard = page.locator('.rounded-card', { hasText: editedTitle });
    await editedCard.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(editedTitle, { exact: true })).toHaveCount(0);

    // --- FULFILLMENT ---
    // Seed a kid purchase (status 'purchased') awaiting hand-off.
    seedPurchasedReward(family, purchasedTitle, 200, '🍦');

    await page.getByRole('tab', { name: 'To give' }).click();
    await expect(page.getByText(purchasedTitle)).toBeVisible();
    await expect(page.getByText(family.kidName)).toBeVisible();

    await page.getByRole('button', { name: /mark as given/i }).click();

    // The row drops once it's marked given.
    await expect(page.getByText(purchasedTitle)).toHaveCount(0);
    await expect(page.getByText(/nothing to hand out/i)).toBeVisible();
  });
});
