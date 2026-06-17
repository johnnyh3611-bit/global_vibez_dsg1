import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Global Vibez DSG E2E smoke suite.
 *
 * Set E2E_BASE_URL to the deployed/staging URL before running in CI.
 * Falls back to the local dev server when running locally.
 *
 * Run: `cd frontend && yarn e2e` (headless) or `yarn e2e:headed` (headed).
 */
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 1,
  reporter: [['list'], ['html', { outputFolder: 'e2e-report', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    headless: true,
    viewport: { width: 1920, height: 900 },
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
