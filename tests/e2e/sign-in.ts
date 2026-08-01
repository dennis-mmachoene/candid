import { createClient } from '@supabase/supabase-js';
import type { Page } from '@playwright/test';

/**
 * Signing in for the end-to-end test.
 *
 * Google's consent screen cannot be automated reliably, and it should not be:
 * a test that drives someone's real Google account is a test that will break
 * the week Google changes a button.
 *
 * So the test signs in through Supabase's admin `generateLink`, which produces
 * a one-time verification URL without sending an email. Navigating to it
 * redirects to Candid's own `/auth/callback`, which exchanges the code for a
 * session exactly as it does for a Google sign-in.
 *
 * Two properties that matter:
 *
 *   - **No test-only code path exists in the application.** There is no
 *     `E2E_MODE` flag, no bypass route, nothing that could be enabled in
 *     production by a mis-set variable. The test uses the same callback every
 *     real user uses.
 *   - **No cookie forgery.** The session is established by the app, not by the
 *     test writing cookies it guessed the format of.
 *
 * Requires `SUPABASE_SECRET_KEY` and the Email provider enabled in Supabase.
 * Sign-ups can stay disabled; `generateLink` is an admin call.
 */

export interface E2ECredentials {
  url: string;
  secretKey: string;
  email: string;
  siteUrl: string;
}

/**
 * Null when the environment is not configured, so tests can skip cleanly.
 *
 * It says which variable is missing, on the way out. A silent skip is the
 * worst failure mode available here: the run reports success while the half of
 * the suite that actually exercises the product never executed, and nobody
 * notices for a month.
 */
export function readE2ECredentials(): E2ECredentials | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const email = process.env.E2E_TEST_EMAIL;
  const siteUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

  const missing = [
    !url && 'NEXT_PUBLIC_SUPABASE_URL',
    !secretKey && 'SUPABASE_SECRET_KEY',
    !email && 'E2E_TEST_EMAIL',
  ].filter(Boolean);

  if (missing.length > 0) {
    console.warn(
      `\n  ⚠  Authenticated end-to-end tests will SKIP. Missing: ${missing.join(', ')}.` +
        `\n     Set them in .env.local — playwright.config.ts loads that file.\n`,
    );
    return null;
  }

  return { url: url!, secretKey: secretKey!, email: email!, siteUrl };
}

function adminClient(credentials: E2ECredentials) {
  return createClient(credentials.url, credentials.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Sign the test user in, leaving the page on whatever the callback redirects
 * to — the consent gate on a fresh account, the dashboard on a returning one.
 */
export async function signIn(
  page: Page,
  credentials: E2ECredentials,
): Promise<void> {
  const admin = adminClient(credentials);

  // The user has to exist before a magic link can be generated for them, and
  // the suite deletes the test account between runs. `email_confirm: true`
  // marks the address verified without sending anything, which is what lets
  // this work with "Confirm email" switched on — as it should be in a real
  // project.
  const { error: createError } = await admin.auth.admin.createUser({
    email: credentials.email,
    email_confirm: true,
  });

  // "already registered" is the expected case on every run after the first
  // within a describe block. Anything else is a real failure.
  if (createError && !/already (been )?registered|already exists/i.test(createError.message)) {
    throw new Error(
      `Could not create the test user. Check SUPABASE_SECRET_KEY. (${createError.message})`,
    );
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: credentials.email,
    options: { redirectTo: `${credentials.siteUrl}/auth/callback` },
  });

  if (error || !data.properties?.action_link) {
    throw new Error(
      `Could not generate a sign-in link. Check SUPABASE_SECRET_KEY and that the Email provider is enabled. (${error?.message ?? 'no link returned'})`,
    );
  }

  await page.goto(data.properties.action_link);
  await page.waitForURL(/\/(consent|dashboard)/, { timeout: 20_000 });
}

/**
 * Remove the test user entirely, which cascades every row they own.
 *
 * Run between tests rather than after: a run that crashes half way should not
 * leave the next run inheriting a half-built account.
 */
export async function deleteTestUser(
  credentials: E2ECredentials,
): Promise<void> {
  const admin = adminClient(credentials);
  const { data } = await admin.auth.admin.listUsers();
  const user = data?.users.find((u) => u.email === credentials.email);
  if (user) await admin.auth.admin.deleteUser(user.id);
}
