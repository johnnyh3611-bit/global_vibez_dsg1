import { Page, expect } from '@playwright/test';

/**
 * Log in as a demo user via the "Demo Login (Quick Access)" button on /login.
 * Assumes protected routes redirect here.
 */
export async function demoLogin(page: Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const demoBtn = page.getByText(/Demo Login/i).first();
  await expect(demoBtn).toBeVisible();
  await demoBtn.click({ force: true });
  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
  await page.waitForTimeout(1500);
}
