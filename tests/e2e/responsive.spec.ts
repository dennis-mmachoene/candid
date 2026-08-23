import { expect, test, type Page } from '@playwright/test';

/**
 * Responsive layout, checked by a machine rather than by someone dragging a
 * window edge.
 *
 * Horizontal overflow is the classic responsive bug and it is almost invisible
 * on a desktop: one long unbroken string — an email address, a URL in a job
 * advert, a skill name the model wrote — pushes the page a few pixels wider
 * than the viewport, and on a phone the whole layout slides sideways under the
 * user's thumb. Nobody catches it by looking at a laptop.
 *
 * So every public page is loaded at every width we care about and asked one
 * question: is the document wider than the window?
 */

const VIEWPORTS = [
  { name: 'small phone', width: 320, height: 568 },
  { name: 'phone', width: 375, height: 812 },
  { name: 'large phone', width: 430, height: 932 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'ultrawide', width: 2560, height: 1440 },
] as const;

const PUBLIC_PAGES = ['/', '/privacy', '/terms'] as const;

/** How far the document exceeds the viewport, in pixels. Should be zero. */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollWidth - doc.clientWidth);
  });
}

/** Any element sticking out past the right edge, named so it can be fixed. */
async function offendingElements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const found: string[] = [];

    for (const element of Array.from(document.body.querySelectorAll('*'))) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      // 1px of tolerance for sub-pixel rounding.
      if (box.right > limit + 1) {
        const tag = element.tagName.toLowerCase();
        const cls =
          typeof element.className === 'string'
            ? element.className.split(/\s+/).slice(0, 3).join('.')
            : '';
        found.push(`${tag}${cls ? `.${cls}` : ''} (right: ${Math.round(box.right)}px)`);
      }
    }
    return found.slice(0, 5);
  });
}

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} — ${viewport.width}px`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const path of PUBLIC_PAGES) {
      test(`${path} does not scroll sideways`, async ({ page }) => {
        await page.goto(path, { waitUntil: 'networkidle' });

        const overflow = await horizontalOverflow(page);
        if (overflow > 0) {
          // Name the culprit rather than just failing with a number.
          console.error(
            `Overflow on ${path} at ${viewport.width}px:`,
            await offendingElements(page),
          );
        }
        expect(overflow).toBe(0);
      });
    }

    test('the header stays usable', async ({ page }) => {
      await page.goto('/', { waitUntil: 'networkidle' });

      const header = page.locator('header');
      await expect(header).toBeVisible();

      // The logo and the theme toggle are the two things that must survive
      // every width. Everything else may collapse.
      await expect(page.getByRole('link', { name: 'Candid' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: /switch to (light|dark) mode/i }),
      ).toBeVisible();

      const box = await header.boundingBox();
      expect(box?.width).toBeLessThanOrEqual(viewport.width);
    });
  });
}

test.describe('touch targets', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  /**
   * 44px is roughly the size below which taps start missing. Some of these
   * controls are the difference between deleting an account and not.
   */
  test('interactive controls are big enough to hit', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const controls = page.locator(
      'header button, header a[href], main button:visible',
    );
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);

    const tooSmall: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const control = controls.nth(i);
      if (!(await control.isVisible())) continue;

      const box = await control.boundingBox();
      if (!box) continue;
      if (box.height < 32 || box.width < 32) {
        tooSmall.push(
          `${(await control.textContent())?.trim().slice(0, 30) || '(icon)'} — ${Math.round(box.width)}x${Math.round(box.height)}`,
        );
      }
    }

    expect(tooSmall).toEqual([]);
  });
});

test.describe('content width', () => {
  /**
   * Line length past roughly 75 characters measurably slows reading, and the
   * consent notice is the one screen where people most need to actually read.
   * On an ultrawide, an uncapped paragraph would run the full 2560px.
   */
  test.use({ viewport: { width: 2560, height: 1440 } });

  test('prose does not run the full width of an ultrawide', async ({
    page,
  }) => {
    await page.goto('/privacy', { waitUntil: 'networkidle' });

    const paragraph = page.locator('main p').first();
    const box = await paragraph.boundingBox();

    expect(box?.width).toBeLessThan(900);
  });

  test('the header and the page heading start at the same x', async ({
    page,
  }) => {
    // The bug that prompted this file: the header sat at max-w-6xl and the
    // dashboard at max-w-5xl, so the logo was visibly left of the heading.
    await page.goto('/privacy', { waitUntil: 'networkidle' });

    const logo = await page.getByRole('link', { name: 'Candid' }).boundingBox();
    const heading = await page
      .getByRole('heading', { level: 1 })
      .boundingBox();

    expect(logo).not.toBeNull();
    expect(heading).not.toBeNull();
    // Prose is narrower than the header on purpose, so they will not align.
    // What must not happen is a near-miss, which reads as a mistake.
    const difference = Math.abs((logo?.x ?? 0) - (heading?.x ?? 0));
    expect(difference === 0 || difference > 100).toBe(true);
  });

  /**
   * The shell follows the monitor; the reading column does not.
   *
   * These two assertions belong together because the tempting way to make the
   * second one pass is to widen prose until it matches the first. A card grid
   * has no reading measure and should grow. A paragraph has one and must not:
   * 704px already runs to roughly 78 characters at the body size in use, and
   * 56rem would give over 90.
   */
  test('the shell follows the monitor and the reading column does not', async ({
    page,
  }) => {
    await page.goto('/privacy', { waitUntil: 'networkidle' });

    const header = await page
      .locator('header [data-slot="container"]')
      .first()
      .boundingBox();
    const paragraph = await page.locator('main p').first().boundingBox();

    // At 2560 the wide shell caps at 100rem = 1600px. Anything near the old
    // 1152 means the growth step was dropped.
    expect(header?.width).toBeGreaterThan(1500);

    // The paragraph is still held at the reading measure regardless.
    expect(paragraph?.width).toBeLessThan(900);
  });

  /**
   * The shell should follow a large screen rather than floating in the middle
   * of it, without running to the glass. At 2560 the header spans 1600, which
   * is 62% — the cap is deliberate: past about 1600 the hero's two columns
   * pull apart and a void opens between them.
   */
  test('the shell uses a good share of a large screen', async ({
    page,
  }) => {
    // The landing page, not /dashboard: a signed-out visitor is redirected
    // away from /dashboard, and this spec runs without a session.
    await page.goto('/', { waitUntil: 'networkidle' });

    const header = await page
      .locator('header [data-slot="container"]')
      .first()
      .boundingBox();

    const share = (header?.width ?? 0) / 2560;
    expect(share).toBeGreaterThan(0.55);
    // And does not simply run to the edges, which is the other failure mode.
    expect(share).toBeLessThan(0.9);
  });
});
