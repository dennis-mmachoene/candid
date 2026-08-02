import { Document, Packer, Paragraph } from 'docx';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

import {
  deleteTestUser,
  readE2ECredentials,
  secondEmail,
  signIn,
} from './sign-in';

/**
 * Two real accounts, and the question nothing else in this project answers:
 * can one user see another user's CV?
 *
 * Every audit of this build has listed cross-account isolation as unverified,
 * and every one was right. Row-Level Security *should* make it impossible, and
 * "should" has been doing a great deal of work in that sentence. The repository
 * never takes a user id, the policies all key on `auth.uid()`, and none of that
 * is evidence. This is evidence.
 *
 * The test attacks from both ends:
 *
 *   1. **Through the application**, where B holds A's CV id and asks for it
 *      directly. A 404 is the correct answer, not a 403 — a 403 confirms the id
 *      exists, and that is itself a leak.
 *   2. **Through the database**, where B's own session queries the tables with
 *      no `where` clause at all. This is the check that matters, because it
 *      bypasses every line of application code. If RLS is wrong, nothing above
 *      it can save the user.
 */

const credentials = readE2ECredentials();

test.describe('two accounts cannot see each other', () => {
  test.skip(
    credentials === null,
    'Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and E2E_TEST_EMAIL to run.',
  );
  test.describe.configure({ mode: 'serial' });

  const emailB = credentials ? secondEmail(credentials) : '';
  let resumeIdOfA = '';

  test.beforeAll(async () => {
    if (!credentials) return;
    await deleteTestUser(credentials, credentials.email);
    await deleteTestUser(credentials, emailB);
  });

  test.afterAll(async () => {
    if (!credentials) return;
    await deleteTestUser(credentials, credentials.email);
    await deleteTestUser(credentials, emailB);
  });

  test('account A uploads a CV', async ({ page }) => {
    await signIn(page, credentials!);
    await page.getByRole('button', { name: /i understand and agree/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.setInputFiles('#cv', {
      name: 'account-a.docx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      buffer: await buildCv('Ayanda Khumalo', 'ayanda@example.co.za'),
    });
    await page.getByRole('button', { name: /upload and de-identify/i }).click();
    await expect(page.getByText(/CV processed/i)).toBeVisible({
      timeout: 30_000,
    });

    // The tailor link carries the resume id. That id is what B will try to use.
    const href = await page
      .getByRole('link', { name: /tailor to a job advert/i })
      .first()
      .getAttribute('href');

    resumeIdOfA = href?.split('/').pop() ?? '';
    expect(resumeIdOfA).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('account B sees an empty dashboard, not A’s CV', async ({
    browser,
  }) => {
    // A fresh context, so none of A's cookies come along.
    const context = await browser.newContext();
    const page = await context.newPage();

    await signIn(page, credentials!, '/dashboard', emailB);
    await page.getByRole('button', { name: /i understand and agree/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await expect(page.getByText(/nothing here yet/i)).toBeVisible();
    await expect(page.getByText('Ayanda')).toHaveCount(0);
    await expect(page.getByText('ayanda@example.co.za')).toHaveCount(0);

    await context.close();
  });

  test('account B cannot open A’s CV by its id', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await signIn(page, credentials!, '/dashboard', emailB);

    const response = await page.goto(`/tailor/${resumeIdOfA}`);

    // 404, not 403. A 403 would confirm the id exists, which is a leak in
    // itself — it tells an attacker their guess was right.
    expect(response?.status()).toBe(404);
    await expect(page.getByText('Ayanda')).toHaveCount(0);

    await context.close();
  });

  test('account B’s history is empty', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await signIn(page, credentials!, '/history', emailB);
    await expect(page.getByText(/nothing tailored yet/i)).toBeVisible();

    await context.close();
  });

  /**
   * The one that actually matters.
   *
   * Everything above goes through application code, so it proves the pages
   * behave. This goes straight to the database with B's own session and asks
   * for everything, with no filter of any kind. If Row-Level Security is
   * misconfigured, this returns A's rows and no amount of careful application
   * code would have helped.
   */
  test('the database itself refuses, with no application code involved', async () => {
    const { access_token } = await sessionFor(credentials!, emailB);

    const asB = createClient(credentials!.url, credentials!.publishableKey, {
      global: { headers: { Authorization: `Bearer ${access_token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Deliberately unfiltered. `select *` on every table holding user data.
    for (const table of [
      'resumes',
      'extracted_skills',
      'job_descriptions',
      'tailored_resumes',
      'consent_records',
    ] as const) {
      const { data, error } = await asB.from(table).select('*');
      expect(error, `${table} query errored`).toBeNull();

      // B has consented, so consent_records legitimately has one row — B's own.
      // Everything else must be empty, because B has uploaded nothing.
      if (table === 'consent_records') {
        expect(data?.length ?? 0, 'B should see only their own consent').toBe(1);
      } else {
        expect(data ?? [], `${table} leaked rows across accounts`).toEqual([]);
      }
    }

    // The rate limiter's table has RLS on and no policy at all, so it should be
    // unreadable even by its owner.
    const { data: limits } = await asB.from('rate_limits').select('*');
    expect(limits ?? [], 'rate_limits should be unreadable').toEqual([]);

    // And a direct request for A's row by id, which is the shape an attacker
    // who has seen an id would actually send.
    const { data: byId } = await asB
      .from('resumes')
      .select('*')
      .eq('id', resumeIdOfA);
    expect(byId ?? [], 'A row was readable by id from another account').toEqual(
      [],
    );
  });
});

// ---------------------------------------------------------------------------

/** A session token for an account, without a browser. */
async function sessionFor(
  credentials: NonNullable<ReturnType<typeof readE2ECredentials>>,
  email: string,
): Promise<{ access_token: string }> {
  const admin = createClient(credentials.url, credentials.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: link } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  const anon = createClient(credentials.url, credentials.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data } = await anon.auth.verifyOtp({
    type: 'magiclink',
    token_hash: link!.properties!.hashed_token,
  });

  return { access_token: data.session!.access_token };
}

async function buildCv(name: string, email: string): Promise<Buffer> {
  const lines = [
    name,
    email,
    '+27 82 555 0134',
    '',
    'Professional Summary',
    'Backend developer with six years building payment systems in Java.',
    '',
    'Experience',
    'Senior Developer, Absa Bank (2020 - present)',
    'Led a team of five engineers delivering a payments API in Java',
    '',
    'Skills',
    'Java, PostgreSQL, Docker',
    '',
    'Personal Details',
    'ID Number: 8001015009087',
  ];

  const document = new Document({
    sections: [{ children: lines.map((text) => new Paragraph({ text })) }],
  });
  return Packer.toBuffer(document);
}
