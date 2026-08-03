import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';

import { cn } from '@/lib/utils';

/**
 * A card is a flat, confident surface separated from the page by a single
 * hairline — no default shadow. Elevation is reserved for things that genuinely
 * float (menus, dialogs), which is the only place `shadow-lift` appears.
 */
function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'bg-card text-card-foreground flex flex-col gap-6 rounded-lg border py-6',
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex flex-col gap-1.5 px-6', className)}
      {...props}
    />
  );
}

/**
 * A card title is a `div` by default, which is right for decorative cards and
 * wrong for cards that are real sections of a page.
 *
 * `asChild` lets a caller supply the correct element:
 *
 *     <CardTitle asChild><h2>Traced to your CV</h2></CardTitle>
 *
 * This is not cosmetic. A screen-reader user navigates by heading, and the
 * integrity report — the most important screen in the product — had three
 * `div`s where its three sections should be. The end-to-end test found it by
 * looking for a heading and not finding one, which is exactly how a person
 * using a screen reader would have found it.
 */
function CardTitle({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<'div'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'div';
  return (
    <Comp
      data-slot="card-title"
      className={cn('leading-snug font-semibold tracking-tight', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('text-muted-foreground text-sm leading-relaxed', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="card-content" className={cn('px-6', className)} {...props} />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center px-6', className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
};
