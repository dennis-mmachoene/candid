import { expect, type Page } from '@playwright/test';

/**
 * Answering the onboarding question, for the specs that need an account past
 * it before they can test anything else.
 *
 * It lives in its own module rather than in each spec because two specs need
 * it and a third will. The selectors here are the only place in the suite that
 * knows what the two buttons say, so a rewording of that screen breaks one
 * file instead of three.
 *
 * Why there is a question at all: `profiles.role` arrived with
 * `not null default 'candidate'`, which meant every new account was already a
 * candidate and the screen was unreachable. Migration 0008 dropped the default
 * so that null means unanswered, and the dashboard sends those accounts here.
 *
 * Answering redirects to that side's home — the job board or the hiring list,
 * not the dashboard. Callers that need the dashboard navigate to it themselves
 * afterwards, rather than this helper pretending to know where they are going.
 */
export async function chooseSide(
  page: Page,
  side: 'candidate' | 'recruiter',
): Promise<void> {
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 30_000 });

  const option = page.getByRole('button', {
    name: side === 'recruiter' ? /i am hiring/i : /i am looking for work/i,
  });

  /*
   * Click until the click has meant something, then submit.
   *
   * The two options are `type="button"` with a React `onClick` behind them, and
   * the form carries the answer in a hidden input driven by that state. A click
   * that lands before the page hydrates hits a DOM node with nothing attached
   * to it. Playwright is satisfied, because the element was visible, enabled
   * and clicked. Nothing happens.
   *
   * This helper had that bug from the day it was written and never showed it.
   * Every caller asked for `candidate`, which is the starting position, so it
   * passed by agreeing with the default rather than by choosing anything. The
   * first caller to ask for `recruiter` was sent to the job board.
   *
   * `toPass` retries the click rather than only waiting after it, because the
   * click itself is the thing that may have been thrown away.
   */
  await expect(async () => {
    await option.click();
    await expect(option).toHaveAttribute('aria-pressed', 'true', {
      timeout: 1_000,
    });
  }).toPass({ timeout: 15_000 });

  await page.getByRole('button', { name: /^continue$/i }).click();

  await expect(page).toHaveURL(side === 'recruiter' ? /\/hiring/ : /\/jobs/, {
    timeout: 30_000,
  });
}
