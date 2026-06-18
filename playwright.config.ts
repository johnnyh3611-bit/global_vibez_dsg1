import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the SolDate Next.js app.
 *
 * Requires a running standalone server:
 *   JWT_SECRET=... DEMO_LOGIN_ENABLED=true node .next/standalone/server.js
 *
 * Or set E2E_BASE_URL to point at a remote instance.
 */
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3300';

export default defineConfig({
  testDir: './playwright',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    headless: true,
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /setup\/.*\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
