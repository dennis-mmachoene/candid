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
 */
const containerVariants = cva('mx-auto w-full px-4 sm:px-6 lg:px-8', {
  variants: {
    width: {
      wide: 'max-w-6xl',
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
