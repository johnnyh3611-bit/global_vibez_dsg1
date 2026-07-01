import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Global Vibez DSG E2E smoke suite.
 *
 * Points at the deployed preview URL (REACT_APP_BACKEND_URL in frontend/.env)
 * so tests can run in CI without spinning up a local dev server.
 *
 * Run: `cd frontend && yarn e2e` (headless) or `yarn e2e:headed` (headed).
 */
const BASE_URL = process.env.E2E_BASE_URL || 'https://social-connect-953.preview.emergentagent.com';

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
