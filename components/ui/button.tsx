import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Buttons are flat and confident. The primary action is a solid fill of the
 * teal accent — no gradient, no glow, no lift-on-hover. Hover only deepens the
 * fill; the single transform anywhere is a 1px press, so the control feels
 * responsive without anything bouncing or shifting the layout around it.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium shrink-0 outline-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
    'transition-[background-color,border-color,color] duration-200 ease-out',
    'focus-visible:ring-ring/60 focus-visible:ring-[3px] focus-visible:ring-offset-0',
    'disabled:pointer-events-none disabled:opacity-50',
    // A press that moves is a press that registered. 1px is enough to feel and
    // small enough not to shift what is next to it. This is the only transform.
    'active:translate-y-px',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border bg-transparent hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        // A darker teal than the fill, so link text clears AA on warm paper.
        link: 'text-brand-700 underline-offset-4 hover:underline dark:text-brand-300',
      },
      size: {
        default: 'h-10 px-5 py-2 has-[>svg]:px-4',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-12 px-7 text-base has-[>svg]:px-6',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
