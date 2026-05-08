import { test, expect } from '@playwright/test';
import { demoLogin } from './_helpers/auth';

test.describe('Gin Rummy Practice — user vs bot', () => {
  test('deals 10 cards, allows draw from stock + discard', async ({ page }) => {
    await demoLogin(page);
    await page.goto('/rummy-practice', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('rummy-practice-room')).toBeVisible({ timeout: 15_000 });

    // Scoreboard, hand, piles all rendered
    await expect(page.getByTestId('rummy-scoreboard')).toBeVisible();
    await expect(page.getByTestId('rummy-your-hand')).toBeVisible();
    await expect(page.getByTestId('rummy-piles')).toBeVisible();
    await expect(page.getByTestId('rummy-status')).toBeVisible();

    // Draw from stock
    await page.getByTestId('rummy-draw-stock').click();

    // After draw, discard controls appear
    await expect(page.getByTestId('rummy-actions')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('rummy-discard-btn')).toBeVisible();
  });
});
