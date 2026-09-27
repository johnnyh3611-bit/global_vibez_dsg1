import { test, expect, type Page } from '@playwright/test';
import { demoLogin } from './_helpers/auth';

async function expectDashboard(page: Page) {
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByTestId('dashboard-job-board')).toBeVisible({ timeout: 20_000 });
}

async function expectEarnHub(page: Page) {
  await expect(page.getByTestId('earn-hub-page')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('earn-cta-chair-vault')).toBeVisible();
}

async function expectGamesHub(page: Page) {
  await expect(page.getByTestId('games-featured-carousel')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('games-category-tabs')).toBeVisible();
}

async function expectDatingHub(page: Page) {
  try {
    await expect(page.getByTestId('vibe-check-entry')).toBeVisible({ timeout: 20_000 });
  } catch {
    await expect(page.getByText(/No More Profiles/i)).toBeVisible({ timeout: 20_000 });
  }
}

async function expectWalletHub(page: Page) {
  try {
    await expect(page.getByTestId('wallet-buy-coins-btn')).toBeVisible({ timeout: 20_000 });
  } catch {
    await expect(page.getByTestId('wallet-chairs-chip')).toBeVisible({ timeout: 20_000 });
  }
}

test.describe('Core loop smoke', () => {
  test('demo login reaches dashboard, earn, games, dating, wallet, and logout', async ({ page }) => {
    await demoLogin(page);

    await expectDashboard(page);

    await page.getByTestId('four-door-earn').click();
    await expectEarnHub(page);

    await page.getByRole('link', { name: /Open wallet/i }).click();
    await expectWalletHub(page);

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expectDashboard(page);

    await page.getByTestId('four-door-play').click();
    await expectGamesHub(page);

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expectDashboard(page);

    await page.getByTestId('four-door-date').click();
    await expectDatingHub(page);

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('dashboard-logout-btn').click();
    await page.waitForURL(/\/login/, { timeout: 20_000 });
    await expect(page.getByTestId('login-page')).toBeVisible();
  });
});
