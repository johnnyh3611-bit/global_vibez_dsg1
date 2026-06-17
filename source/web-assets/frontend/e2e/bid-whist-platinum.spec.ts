import { test, expect } from '@playwright/test';
import { demoLogin } from './_helpers/auth';

test.describe('Bid Whist Platinum — regression', () => {
  test('creates a practice game and loads the table', async ({ page }) => {
    await demoLogin(page);
    await page.goto('/bid-whist-aaa', { waitUntil: 'domcontentloaded' });

    // Route redirects to /bid-whist-aaa/:gameId after POST /start
    await page.waitForURL(/\/bid-whist-aaa\/bidwhist_/, { timeout: 30_000 });

    // The "WHIST" brand in the bidding-ring center badge renders at some point
    // during the game lifecycle.
    await expect(page.getByText('WHIST').first()).toBeVisible({ timeout: 30_000 });
  });
});
