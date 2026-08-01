import { defineConfig, devices } from '@playwright/test';

/**
 * Load `.env.local` into the test runner's own environment.
 *
 * Next loads `.env.local` for the application. It does **not** load it for
 * anything else, and Playwright is a separate process — so without this,
 * `process.env.SUPABASE_SECRET_KEY` is undefined inside a spec, the credential
 * check returns null, and the authenticated tests skip. They skip *silently
 * and correctly*, which is the worst kind of wrong: the suite reports success
 * while the half that matters never ran.
 *
 * `process.loadEnvFile` is built into Node 20.12+ and 22, so this needs no
 * dependency. It throws when the file is absent, which is the normal case in
 * CI where variables come from repository secrets instead.
 */
try {
  process.loadEnvFile('.env.local');
} catch {
  // No .env.local. Fine in CI; the specs will skip if that leaves them
  // without credentials, and say so.
}

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
