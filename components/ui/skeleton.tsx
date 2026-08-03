import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A content-shaped placeholder for genuine waits.
 *
 * Tailoring takes real seconds, so the wait wants to be calm and legible rather
 * than a spinner that says only "something is happening". A skeleton keeps the
 * shape of what is coming, so the page does not jump when it arrives. It is
 * `aria-hidden`: a screen reader is told the region is busy by the `aria-busy`
 * on the surrounding page, and reading out a dozen empty boxes helps no one.
 * The pulse stills itself under `prefers-reduced-motion` (see globals.css).
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn('bg-muted animate-pulse rounded-md', className)}
      {...props}
    />
  );
}

export { Skeleton };
