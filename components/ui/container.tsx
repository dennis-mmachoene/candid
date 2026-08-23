import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * The page container. One decision point for width and gutters.
 *
 * This exists because of a real bug: the header used `max-w-6xl`, the dashboard
 * used `max-w-5xl`, and the reading pages used `max-w-3xl`. On a wide monitor
 * the logo sat visibly left of the page heading — a 128px near-miss, which
 * looks like a mistake in a way that a deliberate 400px difference does not.
 *
 * Three widths, and the choice is editorial rather than arbitrary:
 *
 *   - `wide` for chrome and dashboards, where cards sit side by side.
 *   - `prose` for anything with paragraphs. Line length past roughly 75
 *     characters is measurably harder to read, and the consent notice is the
 *     one screen where we most need people to actually read.
 *   - `narrow` for single-column focus, like the goodbye page.
 *
 * Gutters grow with the viewport rather than staying at a fixed 16px, so
 * content is not pinned to the edge of a phone screen or floating in the
 * middle of an ultrawide with a hard 24px margin.
 *
 * ---
 *
 * The widths themselves live in `app/globals.css` as `.shell*`, written with
 * real media queries. Two reasons.
 *
 * The order is stated rather than inferred. The previous version read
 * `max-w-6xl 2xl:max-w-[80rem] min-[1920px]:max-w-[90rem]`, which only works
 * if the build sorts an arbitrary variant after a named one — an assumption
 * about a tool, in a file that never says so.
 *
 * And `wide` now grows a long way: 1440, then 1600 above 1600, then 1792 above
 * 1920, which is about 93% of a 1920 screen. The header, the footer and the
 * dashboards all use it, so the shell follows the monitor instead of sitting
 * in the middle of it.
 *
 * `prose` stays at 48rem, and this is the part worth not "fixing" later. Its
 * 704px of content already runs to roughly 78 characters per line at the body
 * size actually used, and 88 at the smaller one — at or past the limit above
 * which reading measurably slows. Widening it to 56rem would give 92 to 104.
 * The empty space beside a paragraph on a large monitor is the correct
 * outcome, not a gap to be filled.
 *
 * Below 1024px none of this changes anything. The width is 100% and the gutter
 * is 1rem, exactly as before, so the mobile-first layout is untouched.
 */
const containerVariants = cva('shell', {
  variants: {
    width: {
      wide: 'shell-wide',
      prose: 'shell-prose',
      narrow: 'shell-narrow',
    },
  },
  defaultVariants: { width: 'wide' },
});

function Container({
  className,
  width,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof containerVariants>) {
  return (
    <div
      data-slot="container"
      className={cn(containerVariants({ width }), className)}
      {...props}
    />
  );
}

export { Container, containerVariants };
