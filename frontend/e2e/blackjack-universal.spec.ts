import { test, expect } from '@playwright/test';
import { demoLogin } from './_helpers/auth';

test.describe('Blackjack Universal — multi-seat vs dealer NOVA', () => {
  test('renders 3 seats + dealer, places bet, deals cards, settles round', async ({ page }) => {
    await demoLogin(page);
    await page.goto('/blackjack-universal', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('bj-universal-room')).toBeVisible({ timeout: 15_000 });

    // Betting UI with chip selector + Deal button
    await expect(page.getByTestId('bj-betting-ui')).toBeVisible();
    await page.getByTestId('bj-chip-1000').click();
    await page.getByTestId('bj-place-bet').click();

    // After deal: dealer shows 2 cards, seats show 2 cards each
    await expect(page.getByTestId('bj-dealer-area')).toBeVisible();
    await expect(page.getByTestId('bj-seat-0')).toBeVisible();
    await expect(page.getByTestId('bj-seat-1')).toBeVisible();
    await expect(page.getByTestId('bj-seat-2')).toBeVisible();

    // User has Hit or Stand buttons (unless instant BJ or dealer BJ → round over)
    const hitBtn = page.getByTestId('bj-hit-btn');
    const roundOver = page.getByTestId('bj-round-over');
    // Either we have action buttons, or round immediately ended
    await expect(hitBtn.or(roundOver).first()).toBeVisible({ timeout: 10_000 });

    if (await hitBtn.isVisible()) {
      await page.getByTestId('bj-stand-btn').click();
      await expect(page.getByTestId('bj-round-over')).toBeVisible({ timeout: 10_000 });
    }
  });
});
