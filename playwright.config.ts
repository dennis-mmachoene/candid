import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration.
 *
 * Two things worth knowing:
 *
 *   - The suite starts `next dev` itself unless `E2E_BASE_URL` points somewhere
 *     else, so `npm run e2e` works from a clean checkout with no ceremony.
 *   - It runs single-worker. These tests share one Supabase project and one
 *     test account; running them in parallel would have them delete each
 *     other's rows and produce failures that look like product bugs.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,

  // A `.only` left in a commit would silently skip the rest of the suite in CI.
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'en-ZA',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
