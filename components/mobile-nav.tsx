'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { History, Menu, Settings, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * The signed-in menu on small screens.
 *
 * The header carries five things when signed in — a greeting, history,
 * settings, the theme toggle and sign out. On a 320px phone that is roughly
 * twice the available width, so below `sm` they collapse into this and only
 * the theme toggle stays out, because switching to dark mode at night is the
 * one thing people do without thinking.
 *
 * Sign out is deliberately **not** in here. It is a form posting to a Server
 * Action, and burying a destructive-adjacent action behind a menu that also
 * contains navigation is how people sign out by accident.
 */
export function MobileNav({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Navigating should close the menu. Without this it stays open over the new
  // page, which reads as the link having done nothing.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div ref={panelRef} className="relative sm:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="tap-target"
      >
        {open ? (
          <X className="size-5" aria-hidden />
        ) : (
          <Menu className="size-5" aria-hidden />
        )}
      </Button>

      {open ? (
        <div
          id="mobile-menu"
          className="bg-popover animate-fade absolute right-0 z-50 mt-2 w-60 origin-top-right rounded-lg border p-2 shadow-lift"
        >
          <p className="text-muted-foreground break-anywhere px-3 py-2 text-xs">
            {email}
          </p>
          <div className="bg-border my-1 h-px" />
          <Link
            href="/history"
            className="hover:bg-accent tap-target flex items-center gap-3 rounded-lg px-3 text-sm transition-colors"
          >
            <History className="size-4" aria-hidden />
            History
          </Link>
          <Link
            href="/settings"
            className="hover:bg-accent tap-target flex items-center gap-3 rounded-lg px-3 text-sm transition-colors"
          >
            <Settings className="size-4" aria-hidden />
            Settings
          </Link>
        </div>
      ) : null}
    </div>
  );
}
