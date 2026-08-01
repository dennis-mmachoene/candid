import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * The verdict variants are not decoration. `accepted`, `borderline` and
 * `blocked` map to the three outcomes of the anti-fabrication rule, and they
 * are the only place those colours are used. Reaching for `blocked` because
 * something should look red would make the integrity report ambiguous.
 */
const badgeVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'text-foreground',
        brand:
          'border-brand-500/30 bg-brand-500/10 text-brand-700 dark:text-brand-300',
        accepted:
          'border-accepted/35 bg-accepted-surface/60 text-accepted',
        borderline:
          'border-borderline/35 bg-borderline-surface/60 text-borderline',
        blocked: 'border-blocked/35 bg-blocked-surface/60 text-blocked',
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
