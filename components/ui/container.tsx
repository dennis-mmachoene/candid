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
 * `wide` grows on large monitors and `prose` deliberately does not.
 *
 * On a 2560px screen a fixed 1152px shell leaves 45% of the display empty and
 * the app reads as a phone layout that has been stretched. A card grid has no
 * reading-measure constraint, so it can use that space: 1280px above 1536, and
 * 1440px above 1920.
 *
 * `prose` stays at 48rem, and this is the part worth not "fixing" later. Its
 * 704px of content already runs to roughly 78 characters per line at the body
 * size actually used, and 88 at the smaller one — at or past the limit above
 * which reading measurably slows. Widening it to 56rem would give 92 to 104.
 * The empty space beside a paragraph on a large monitor is the correct
 * outcome, not a gap to be filled.
 */
const containerVariants = cva('mx-auto w-full px-4 sm:px-6 lg:px-8', {
  variants: {
    width: {
      wide: 'max-w-6xl 2xl:max-w-[80rem] min-[1920px]:max-w-[90rem]',
      prose: 'max-w-3xl',
      narrow: 'max-w-xl',
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
