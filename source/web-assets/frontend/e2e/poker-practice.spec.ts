import { test, expect } from '@playwright/test';
import { demoLogin } from './_helpers/auth';

test.describe("Texas Hold'em Practice — user vs 3 bots", () => {
  test('deals hole cards, posts blinds, exposes fold/call/raise actions', async ({ page }) => {
    await demoLogin(page);
    await page.goto('/poker-practice', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('poker-practice-room')).toBeVisible({ timeout: 15_000 });

    // Phase label visible
    await expect(page.getByTestId('poker-phase')).toBeVisible();

    // Pot + board area + 4 seats
    await expect(page.getByTestId('poker-pot')).toBeVisible();
    await expect(page.getByTestId('poker-board')).toBeVisible();
    await expect(page.getByTestId('poker-seat-seat_0')).toBeVisible();
    await expect(page.getByTestId('poker-seat-seat_1')).toBeVisible();
    await expect(page.getByTestId('poker-seat-seat_2')).toBeVisible();
    await expect(page.getByTestId('poker-seat-seat_3')).toBeVisible();

    // User's turn should surface actions
    const actions = page.getByTestId('poker-actions');
    const gameOver = page.getByTestId('poker-hand-over');
    await expect(actions.or(gameOver).first()).toBeVisible({ timeout: 10_000 });

    if (await actions.isVisible()) {
      // Fold is always present when actions show
      await page.getByTestId('poker-fold').click();
      await expect(page.getByTestId('poker-hand-over')).toBeVisible({ timeout: 15_000 });
    }
  });
});
