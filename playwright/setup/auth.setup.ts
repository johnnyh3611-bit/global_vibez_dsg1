import { test as setup, expect } from '@playwright/test';

/**
 * Auth setup: hit the demo-login endpoint, then persist the resulting session
 * cookie so all tests in the 'chromium' project start pre-authenticated.
 *
 * Requires DEMO_LOGIN_ENABLED=true on the server (set in .env.local).
 */
setup('authenticate with demo login', async ({ request, context }) => {
  const response = await request.post('/api/auth/demo-login');
  expect(response.ok()).toBeTruthy();

  // Persist the dating-auth-token cookie for subsequent test runs
  await context.storageState({ path: 'playwright/.auth/user.json' });
});
