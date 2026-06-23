import { test, expect } from '@playwright/test';
import { loginAsParent } from './helpers/login';
import { seedFamilyWithParentAndKid, teardownFamily, type SeededFamily } from './helpers/seed';

// Golden path 4 (task #52): account & family deletion UI wiring.
//
// We verify the type-to-confirm GATE — that "Delete everything" is disabled
// until the exact family name is typed, then enabled — rather than executing a
// real delete (the backend PR #28 already proves deletion E2E, and a real
// delete would destroy the session mid-spec). The seeded family is torn down in
// afterAll regardless.

test.describe('settings → danger zone', () => {
  let family: SeededFamily;
  const token = `${Date.now()}`;

  test.beforeAll(async () => {
    family = await seedFamilyWithParentAndKid({ token: `d${token}`, kidName: 'Mia' });
  });

  test.afterAll(async () => {
    await teardownFamily(family);
  });

  test('type-to-confirm gates the Delete everything button', async ({ page }) => {
    await loginAsParent(page, family.parent.email, family.parent.password);

    // Reach Settings from the dashboard header.
    await page.getByRole('link', { name: 'Settings' }).first().click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Danger zone' })).toBeVisible();

    // Open the destructive "Delete family" modal.
    await page.getByRole('button', { name: 'Delete family' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Delete family?' })).toBeVisible();

    const deleteBtn = dialog.getByRole('button', { name: 'Delete everything' });
    const confirmInput = dialog.getByLabel(/Type .* to confirm/);

    // Gate closed initially.
    await expect(deleteBtn).toBeDisabled();

    // A wrong value keeps it disabled.
    await confirmInput.fill('not the family name');
    await expect(deleteBtn).toBeDisabled();

    // The exact family name opens the gate.
    await confirmInput.fill(family.familyName);
    await expect(deleteBtn).toBeEnabled();

    // Clearing it closes the gate again.
    await confirmInput.fill('');
    await expect(deleteBtn).toBeDisabled();
  });
});
