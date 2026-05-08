import { test, expect } from '@playwright/test';
import { demoLogin } from './_helpers/auth';

test.describe('Spades Practice — bots vs user', () => {
  test('deals 13 cards, shows bid overlay, places bid, enters playing phase', async ({ page }) => {
    await demoLogin(page);
    await page.goto('/spades-practice', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('spades-practice-room')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('spades-bid-overlay')).toBeVisible({ timeout: 15_000 });

    // Scoreboard present with Team 1 / Team 2 points
    await expect(page.getByTestId('spades-scoreboard')).toBeVisible();

    // User has a 13-card hand rendered
    const yourHand = page.getByTestId('spades-your-hand');
    await expect(yourHand).toBeVisible();

    // Bid 4 books
    await page.getByTestId('spades-bid-4').click();
    await page.getByTestId('spades-submit-bid').click();

    // Bid overlay dismisses, playing phase begins
    await expect(page.getByTestId('spades-bid-overlay')).toBeHidden({ timeout: 10_000 });
    await expect(page.getByTestId('spades-trick-pile')).toBeVisible();
  });
});
