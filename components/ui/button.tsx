import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium shrink-0 outline-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
    'transition-[transform,box-shadow,background-color,border-color,color] duration-200 ease-out',
    'focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:ring-offset-0',
    'disabled:pointer-events-none disabled:opacity-50',
    // A press that moves is a press that registered. 1px is enough to feel
    // and small enough not to shift what is next to it.
    'active:translate-y-px',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'gradient-brand text-primary-foreground shadow-soft hover:shadow-lift hover:-translate-y-0.5 hover:brightness-110',
        destructive:
          'bg-destructive text-destructive-foreground shadow-soft hover:brightness-110',
        outline:
          'border bg-background/60 backdrop-blur-sm hover:bg-accent hover:text-accent-foreground hover:border-brand-500/40',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 py-2 has-[>svg]:px-4',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-12 rounded-xl px-7 text-base has-[>svg]:px-6',
        icon: 'size-9 rounded-lg',
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
