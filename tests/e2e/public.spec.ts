import { expect, test } from '@playwright/test';

/**
 * The public journey. Runs with no credentials, so it runs everywhere.
 *
 * The most valuable test in this file is the CSP one. A Content Security Policy
 * fails silently: it does not error, it just blocks something, and the page
 * quietly loses a feature. The only way to know is to read the console, and the
 * only way to keep knowing is to have a machine read it on every commit.
 */

/** Console messages that mean the CSP is blocking something we need. */
const CSP_VIOLATION = /content security policy|refused to (load|execute|apply)/i;

test.describe('landing page', () => {
  test('loads and says what the product is', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: /an honest CV/i }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /sign in with google/i }).first(),
    ).toBeVisible();
  });

  test('serves the security headers', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers() ?? {};

    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');

    const csp = headers['content-security-policy'] ?? '';
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("'strict-dynamic'");
    // The assertion that matters: a CSP allowing inline script is decoration.
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  test('uses a different nonce on every request', async ({ page }) => {
    const nonces = new Set<string>();

    for (let i = 0; i < 3; i += 1) {
      const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
      const csp = response?.headers()['content-security-policy'] ?? '';
      nonces.add(/'nonce-([^']+)'/.exec(csp)?.[1] ?? '');
    }

    expect(nonces.size).toBe(3);
  });

  /**
   * The check I would otherwise be asking a human to do on every page, forever.
   */
  test('renders with no CSP violations', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (message) => {
      if (CSP_VIOLATION.test(message.text())) violations.push(message.text());
    });

    for (const path of ['/', '/privacy', '/terms']) {
      await page.goto(path, { waitUntil: 'networkidle' });
    }

    expect(violations).toEqual([]);
  });

  test('is indexable, unlike the signed-in routes', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.headers()['x-robots-tag']).toBeUndefined();
  });
});

test.describe('theme', () => {
  test('switches between light and dark and stays switched', async ({ page }) => {
    await page.goto('/');

    const html = page.locator('html');
    const before = (await html.getAttribute('class')) ?? '';

    await page
      .getByRole('button', { name: /switch to (light|dark) mode/i })
      .click();
    await expect(html).not.toHaveClass(before);

    const after = (await html.getAttribute('class')) ?? '';
    await page.reload();
    // next-themes writes an inline script before paint. If the CSP nonce were
    // not reaching it, that script would be blocked and the choice would be
    // lost on reload — so this also tests the nonce plumbing.
    await expect(html).toHaveClass(after);
  });
});

test.describe('the gate', () => {
  for (const path of ['/dashboard', '/settings', '/history']) {
    test(`sends a signed-out visitor away from ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/\?signin=required/);
    });
  }

  test('does not leak whether a CV id exists', async ({ page }) => {
    // A signed-out request for a real-looking id must be indistinguishable
    // from one for an invented id: both go to sign-in.
    await page.goto('/review/00000000-0000-0000-0000-000000000000');
    await expect(page).toHaveURL(/\/\?signin=required/);
  });
});

test.describe('legal pages', () => {
  test('privacy names the operators', async ({ page }) => {
    await page.goto('/privacy');

    await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();
    await expect(page.getByText('Anthropic (Claude)')).toBeVisible();
    await expect(
      page.getByText(/receives no identifying data/i).first(),
    ).toBeVisible();
  });

  test('terms states what Candid will not do', async ({ page }) => {
    await page.goto('/terms');
    await expect(
      page.getByRole('heading', { name: /what candid will not do/i }),
    ).toBeVisible();
  });
});
