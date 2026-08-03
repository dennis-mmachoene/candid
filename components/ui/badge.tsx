import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Badges wear the one modest radius, not a pill, so they read as part of the
 * same system as everything else.
 *
 * The verdict variants are not decoration. `accepted`, `borderline` and
 * `blocked` map to the three outcomes of the anti-fabrication rule, and they
 * are the only place those colours are used. Reaching for `blocked` because
 * something should look red would make the integrity report ambiguous.
 */
const badgeVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground',
        brand:
          'border-brand-500/30 bg-brand-500/10 text-brand-700 dark:text-brand-300',
        accepted: 'border-accepted/30 bg-accepted-surface/70 text-accepted',
        borderline:
          'border-borderline/30 bg-borderline-surface/70 text-borderline',
        blocked: 'border-blocked/30 bg-blocked-surface/70 text-blocked',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
