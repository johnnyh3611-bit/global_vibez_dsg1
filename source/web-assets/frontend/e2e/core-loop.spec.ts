import { test, expect } from '@playwright/test';
import { demoLogin } from './_helpers/auth';

test.describe('Core loop smoke', () => {
  test('demo login reaches dashboard, earn, games, dating, wallet, and logout', async ({ page }) => {
    await demoLogin(page);

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByTestId('dashboard-job-board')).toBeVisible({ timeout: 20_000 });

    await page.goto('/earn', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('earn-hub-page')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('earn-cta-chair-vault')).toBeVisible();

    await page.goto('/games', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('games-featured-carousel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('games-category-tabs')).toBeVisible();

    await page.goto('/dating/discover', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByTestId('vibe-check-entry').or(page.getByText(/No More Profiles/i)).first()
    ).toBeVisible({ timeout: 20_000 });

    await page.goto('/wallet', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByTestId('wallet-buy-coins-btn').or(page.getByTestId('wallet-chairs-chip')).first()
    ).toBeVisible({ timeout: 20_000 });

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('dashboard-logout-btn').click();
    await page.waitForURL(/\/login/, { timeout: 20_000 });
    await expect(page.getByTestId('login-page')).toBeVisible();
  });
});
