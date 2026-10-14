import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

import { chooseSide } from './onboarding';
import {
  deleteTestUser,
  readE2ECredentials,
  secondEmail,
  sessionFor,
  signIn,
} from './sign-in';

/**
 * Two sides of the hire, and the question nothing in the suite asked until
 * now: can one side reach the other's half of the product?
 *
 * It could. Every signed-in account could open every page. A job seeker could
 * walk onto the hiring list, open the posting form, write an advert and press
 * post, and only then be told no, by a database error with no explanation in
 * it. An employer could open the CV dashboard, the tailoring screen and the
 * applications list. One of them could do worse than look: the policy on
 * `applications` never checked which side the caller was on, so an employer
 * applying to a vacancy, including their own, would have been written.
 *
 * None of that was a leak. Nobody could read anybody else's rows at any point,
 * and `isolation.spec.ts` is where that is proved. This is a different
 * property, and it needed its own test: the product has two halves, and an
 * account belongs to exactly one of them.
 *
 * The spec checks it at both levels, because they fail differently:
 *
 *   1. **Through the application**, where the wrong side is sent home before
 *      a screen is ever drawn. This is the part that matters to a person. An
 *      option that is offered and then refused at submission is worse than no
 *      option, because the refusal arrives after the work.
 *   2. **Through the database**, where the policy refuses a request that never
 *      went near a page. This is the part that matters if the application is
 *      wrong, and it is the only reason the earlier mistake was ugly rather
 *      than dangerous.
 */

const credentials = readE2ECredentials();

// Two accounts of this spec's own. The isolation spec owns the primary address
// and `+candid-isolation`, and it deletes them in `beforeAll`, so sharing
// either one would mean one spec file pulling the account out from under the
// other whenever Playwright ran them at the same time.
const seekerEmail = credentials ? secondEmail(credentials, 'sides-seeker') : '';
const employerEmail = credentials
  ? secondEmail(credentials, 'sides-employer')
  : '';

test.describe('the two sides stay apart', () => {
  test.skip(
    credentials === null,
    'Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and E2E_TEST_EMAIL to run.',
  );
  test.describe.configure({ mode: 'serial' });

  // The role the employer posts, which the rest of the spec needs something to
  // point at. The title carries a timestamp so a half-finished earlier run
  // cannot be mistaken for this one's.
  const title = `Platform Engineer ${Date.now()}`;
  let jobId = '';

  test.beforeAll(async () => {
    if (!credentials) return;
    await deleteTestUser(credentials, seekerEmail);
    await deleteTestUser(credentials, employerEmail);
  });

  test.afterAll(async () => {
    if (!credentials) return;
    await deleteTestUser(credentials, seekerEmail);
    await deleteTestUser(credentials, employerEmail);
  });

  test('an employer posts a role', async ({ page }) => {
    await signIn(page, credentials!, '/dashboard', employerEmail);
    await chooseSide(page, 'recruiter');

    await page.goto('/hiring/new');
    await page.fill('#company', 'Kriterion Labs');
    await page.fill('#location', 'Johannesburg');
    await page.fill('#title', title);
    await page.fill(
      '#description',
      'We look after the deployment pipeline and the infrastructure underneath it. ' +
        'The team is four people and you would be the third engineer on the platform side.',
    );
    await page.fill(
      '#requirements',
      'Five years with Linux\nTerraform\nPostgreSQL\nA language that is not shell',
    );
    await page.getByRole('button', { name: /post this role/i }).click();

    // postJob redirects to the new role's applicant list, which is where the
    // id comes from. Nothing else in this spec invents one.
    await page.waitForURL(/\/hiring\/[0-9a-f-]{36}/, { timeout: 30_000 });
    jobId = page.url().split('/hiring/')[1]!;
    expect(jobId).toHaveLength(36);
  });

  test('the employer is sent away from the job seeker’s screens', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await signIn(page, credentials!, '/hiring', employerEmail);

    // /dashboard is in this list on purpose. It is where sign-in lands, so it
    // is the first page an employer sees and the first one that has to know
    // they are not a job seeker.
    for (const path of [
      '/dashboard',
      '/jobs',
      '/applications',
      '/profile',
      '/history',
    ]) {
      await page.goto(path);
      await expect(page, `${path} opened for an employer`).toHaveURL(/\/hiring/);
    }

    // And the menu does not offer the trip in the first place, which is the
    // point. A redirect is a correction; an absent link is a design.
    await expect(page.getByRole('link', { name: 'Hiring' })).toHaveCount(1);
    for (const label of ['Jobs', 'Applications', 'My CV', 'Profile']) {
      await expect(
        page.getByRole('link', { name: label }),
        `the employer's menu offered ${label}`,
      ).toHaveCount(0);
    }

    await context.close();
  });

  test('the job seeker is sent away from the hiring screens', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await signIn(page, credentials!, '/dashboard', seekerEmail);
    await chooseSide(page, 'candidate');

    for (const path of ['/hiring', '/hiring/new', `/hiring/${jobId}`]) {
      await page.goto(path);
      await expect(page, `${path} opened for a job seeker`).toHaveURL(/\/jobs/);
    }

    await expect(page.getByRole('link', { name: 'Jobs' })).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Hiring' })).toHaveCount(0);

    await context.close();
  });

  test('the employer may read their own advert and not apply to it', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await signIn(page, credentials!, '/hiring', employerEmail);
    await page.goto(`/jobs/${jobId}`);

    // The one page that serves both sides, because "See it as a candidate
    // does" has to lead somewhere.
    await expect(page).toHaveURL(new RegExp(`/jobs/${jobId}`));
    await expect(
      page.getByRole('heading', { name: /this is your role/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /apply/i }),
      'an employer was offered Apply on their own vacancy',
    ).toHaveCount(0);

    await context.close();
  });

  /**
   * The one that matters, and the mirror of the same test in the isolation
   * spec: no page, no form, no application code. A session token and a table.
   *
   * `saved_jobs` is the table under test rather than `applications`, and the
   * reason is that it has no check constraints on it. An insert into
   * `applications` has to satisfy `applications_source_matches_mode`, which
   * needs a stored CV to point at, and a refusal could then have come from the
   * constraint rather than from the policy — which would make the test prove
   * nothing. Both policies call the same `is_candidate()`, added in migration
   * 0009, so this is where that function is actually exercised.
   *
   * Both directions are asserted. A policy that refuses everybody is not a
   * working policy, and that mistake would otherwise pass.
   */
  test('the database allows the job seeker and refuses the employer', async () => {
    const asUser = async (email: string) => {
      const { access_token } = await sessionFor(credentials!, email);
      return createClient(credentials!.url, credentials!.publishableKey, {
        global: { headers: { Authorization: `Bearer ${access_token}` } },
        auth: { autoRefreshToken: false, persistSession: false },
      });
    };

    // `user_id` defaults to auth.uid(), so this is a complete and valid row.
    // The only thing that can refuse it is the policy.
    const asSeeker = await asUser(seekerEmail);
    const { error: allowed } = await asSeeker
      .from('saved_jobs')
      .insert({ job_id: jobId });
    expect(allowed, 'a job seeker could not save a role').toBeNull();

    const asEmployer = await asUser(employerEmail);
    const { error: refused } = await asEmployer
      .from('saved_jobs')
      .insert({ job_id: jobId });

    expect(refused, 'an employer was allowed to save a role').not.toBeNull();
    // 42501 is insufficient_privilege, which is what a Row-Level Security
    // refusal reports. Asserting the code rather than just "an error" is what
    // stops this passing for the wrong reason later.
    expect(refused?.code, 'the refusal did not come from the policy').toBe(
      '42501',
    );
  });
});
