import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { BrowserContext, Page } from '@playwright/test';

/**
 * Signing in for the end-to-end test.
 *
 * Google's consent screen cannot be automated reliably, and it should not be: a
 * test that drives a real Google account breaks the week Google changes a
 * button.
 *
 * The obvious alternative — navigating Supabase's `generateLink` URL — does not
 * work here, and the reason is worth writing down because it looked like a bug
 * and was not. That link returns the session in the URL **fragment**
 * (`#access_token=...`), the implicit flow. Candid's `/auth/callback` only
 * accepts `?code=`, the PKCE flow, which is what `signInWithOAuth` produces for
 * Google. So the callback refused the fragment and redirected to `?error=auth`,
 * which is correct behaviour.
 *
 * Making the callback also accept email OTP tokens would have made the test
 * pass by widening the application's authentication surface. Candid is
 * deliberately Google-only. The test adapts instead.
 *
 * So: obtain a real session through Supabase's own API, then let
 * `@supabase/ssr` serialise it into cookies using its own encoding, and hand
 * those to the browser. Three properties matter:
 *
 *   - **No production code changes.** Nothing here exists for the test's
 *     benefit. There is no `E2E_MODE`, no bypass route, nothing a mis-set
 *     variable could switch on in production.
 *   - **No guessed cookie format.** The chunking and naming come from the
 *     library that reads them back, not from a test author's assumption about
 *     what it looks like.
 *   - **A genuine session.** The token is issued by Supabase Auth and verified
 *     by Supabase Auth. Nothing is faked; it is the same session a real
 *     sign-in produces.
 */

export interface E2ECredentials {
  url: string;
  secretKey: string;
  publishableKey: string;
  email: string;
  siteUrl: string;
}

/**
 * Null when the environment is not configured, so tests can skip cleanly.
 *
 * It says which variable is missing, on the way out. A silent skip is the worst
 * failure mode available here: the run reports success while the half of the
 * suite that actually exercises the product never executed, and nobody notices
 * for a month.
 */
export function readE2ECredentials(): E2ECredentials | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.E2E_TEST_EMAIL;
  const siteUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

  const missing = [
    !url && 'NEXT_PUBLIC_SUPABASE_URL',
    !secretKey && 'SUPABASE_SECRET_KEY',
    !publishableKey && 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    !email && 'E2E_TEST_EMAIL',
  ].filter(Boolean);

  if (missing.length > 0) {
    console.warn(
      `\n  ⚠  Authenticated end-to-end tests will SKIP. Missing: ${missing.join(', ')}.` +
        `\n     Set them in .env.local — playwright.config.ts loads that file.\n`,
    );
    return null;
  }

  return {
    url: url!,
    secretKey: secretKey!,
    publishableKey: publishableKey!,
    email: email!,
    siteUrl,
  };
}

function adminClient(credentials: E2ECredentials) {
  return createClient(credentials.url, credentials.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Obtain a real session for the test account, through Supabase's own API. */
async function createSession(credentials: E2ECredentials): Promise<{
  access_token: string;
  refresh_token: string;
}> {
  const admin = adminClient(credentials);

  // The user has to exist before a link can be generated, and the suite deletes
  // the account between runs. `email_confirm: true` marks the address verified
  // without sending anything, which is what lets this work with "Confirm email"
  // switched on — as it should be in a real project.
  const { error: createError } = await admin.auth.admin.createUser({
    email: credentials.email,
    email_confirm: true,
  });

  if (
    createError &&
    !/already (been )?registered|already exists/i.test(createError.message)
  ) {
    throw new Error(
      `Could not create the test user. Check SUPABASE_SECRET_KEY. (${createError.message})`,
    );
  }

  const { data: link, error: linkError } =
    await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: credentials.email,
    });

  if (linkError || !link.properties?.hashed_token) {
    throw new Error(
      `Could not generate a sign-in token. Check that the Email provider is enabled in Supabase. (${linkError?.message ?? 'no token returned'})`,
    );
  }

  // Redeemed with the publishable key, exactly as a browser would. The admin
  // key cannot do this, and should not be able to.
  const anon = createClient(credentials.url, credentials.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await anon.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link.properties.hashed_token,
  });

  if (error || !data.session) {
    throw new Error(`Could not verify the sign-in token. (${error?.message})`);
  }

  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
}

/**
 * Turn a session into the cookies Candid's server client will read back.
 *
 * `createServerClient` is given a cookie store that records instead of storing.
 * Calling `setSession` makes it emit exactly the cookies it would set in the
 * app — same names, same chunking, same encoding — so nothing here depends on
 * knowing that format.
 */
async function sessionCookies(
  credentials: E2ECredentials,
  session: { access_token: string; refresh_token: string },
): Promise<{ name: string; value: string }[]> {
  const captured: { name: string; value: string }[] = [];

  const recorder = createServerClient(
    credentials.url,
    credentials.publishableKey,
    {
      cookies: {
        getAll: () => [],
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) {
            captured.push({ name, value });
          }
        },
      },
    },
  );

  await recorder.auth.setSession(session);

  if (captured.length === 0) {
    throw new Error('No auth cookies were produced. The SSR client may have changed.');
  }

  return captured;
}

/**
 * Sign the test user in and land on `path`.
 *
 * Defaults to `/dashboard`, which a fresh account will be redirected away from
 * to `/consent` — exercising the gate rather than stepping around it.
 */
export async function signIn(
  page: Page,
  credentials: E2ECredentials,
  path = '/dashboard',
): Promise<void> {
  const session = await createSession(credentials);
  const cookies = await sessionCookies(credentials, session);

  const context: BrowserContext = page.context();
  await context.addCookies(
    cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      url: credentials.siteUrl,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    })),
  );

  await page.goto(path);
  await page.waitForURL(/\/(consent|dashboard|settings|history)/, {
    timeout: 20_000,
  });
}

/**
 * Remove the test user entirely, which cascades every row they own.
 *
 * Run before tests rather than only after: a run that crashes half way should
 * not leave the next one inheriting a half-built account.
 */
export async function deleteTestUser(
  credentials: E2ECredentials,
): Promise<void> {
  const admin = adminClient(credentials);
  const { data } = await admin.auth.admin.listUsers();
  const user = data?.users.find((u) => u.email === credentials.email);
  if (user) await admin.auth.admin.deleteUser(user.id);
}
