import { test, expect } from '@playwright/test';
import { loginAsParent } from './helpers/login';
import {
  seedFamilyWithParentAndKid,
  seedPendingCompletion,
  kidWalletBalance,
  teardownFamily,
  type SeededFamily,
} from './helpers/seed';

// Golden path 2: create chore → approve → points appear.
//
// A pre-confirmed parent + family + kid + a PENDING chore completion are seeded
// via SQL (the kid-completes-a-chore step can't happen on web). The parent logs
// in, approves the completion in the Approvals queue (firing the atomic
// award_points_on_approval fn), and we assert the points landed both in the kid's
// wallet (DB) and on the parent's Point-history screen (UI).

const POINTS = 25;
const CHORE_TITLE = 'Take out the trash';

test.describe('create chore → approve → points appear', () => {
  let family: SeededFamily;

  test.beforeAll(async () => {
    family = await seedFamilyWithParentAndKid({ token: `c${Date.now()}`, kidName: 'Mia' });
    seedPendingCompletion(family, CHORE_TITLE, POINTS);
  });

  test.afterAll(async () => {
    await teardownFamily(family);
  });

  test('approving a chore awards points to the kid', async ({ page }) => {
    // Baseline: kid starts at 0.
    expect(kidWalletBalance(family.kidId)).toBe(0);

    await loginAsParent(page, family.parent.email, family.parent.password);

    // Go to Approvals — the seeded pending completion is in the Chores tab.
    await page.getByRole('link', { name: 'Approvals' }).first().click();
    await expect(page.getByText(CHORE_TITLE)).toBeVisible();
    await expect(page.getByText(family.kidName)).toBeVisible();

    // Approve & pay → success toast confirms the award.
    await page.getByRole('button', { name: /approve & pay/i }).click();
    await expect(page.getByText(new RegExp(`\\+${POINTS} points awarded`, 'i'))).toBeVisible();

    // The row drops from the queue.
    await expect(page.getByText(CHORE_TITLE)).toHaveCount(0);

    // DB: the atomic fn credited the kid's wallet.
    await expect.poll(() => kidWalletBalance(family.kidId)).toBe(POINTS);

    // UI: the parent's Point-history modal reflects the new balance + an
    // "Earned" transaction for this kid.
    await page.getByRole('link', { name: 'Kids' }).first().click();
    await expect(page.getByRole('heading', { name: 'Kids' })).toBeVisible();
    await page.getByRole('button', { name: 'History' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(`${POINTS} pts`)).toBeVisible();
    await expect(dialog.getByText('Earned')).toBeVisible();
  });
});
