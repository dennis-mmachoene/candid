'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Briefcase,
  FileText,
  History,
  Menu,
  Search,
  Send,
  Settings,
  User,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * The signed-in menu on small screens.
 *
 * The header carries the whole navigation when signed in. On a 320px phone
 * that is roughly twice the available width, so below `sm` it collapses into
 * this and only the theme toggle stays out, because switching to dark mode at
 * night is the one thing people do without thinking.
 *
 * The links mirror the header exactly, including which role sees what. A phone
 * menu that offered a different set of pages from the desktop one would be a
 * second place to keep in step, and it would get forgotten.
 *
 * Sign out is deliberately **not** in here. It is a form posting to a Server
 * Action, and burying a destructive-adjacent action behind a menu that also
 * contains navigation is how people sign out by accident.
 */

/**
 * Spelled out rather than imported from the job repository.
 *
 * This is a Client Component, and the repository is infrastructure: a type-only
 * import would be erased at build time, but the import line itself is the kind
 * of thing that later grows a value import by accident. The database enum is
 * `('candidate', 'recruiter')` and migration 0005 is the single source of it.
 */
type Role = 'candidate' | 'recruiter' | null;

const CANDIDATE_LINKS = [
  { href: '/jobs', label: 'Jobs', icon: Search },
  { href: '/applications', label: 'Applications', icon: Send },
  { href: '/dashboard', label: 'My CV', icon: FileText },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/history', label: 'History', icon: History },
];

const RECRUITER_LINKS = [{ href: '/hiring', label: 'Hiring', icon: Briefcase }];

/*
  Settings is the only page both sides share, and that is the whole point.

  History used to sit here, which put "your tailored CVs" in an employer's
  menu. They have none and cannot have any, so the link went to a page that
  was empty by definition. It is a job seeker's link and now lives there.
*/
const SHARED_LINKS = [{ href: '/settings', label: 'Settings', icon: Settings }];

export function MobileNav({ email, role }: { email: string; role: Role }) {
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

  const links = [
    ...(role === 'recruiter' ? RECRUITER_LINKS : CANDIDATE_LINKS),
    ...SHARED_LINKS,
  ];

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
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:bg-accent tap-target flex items-center gap-3 rounded-lg px-3 text-sm transition-colors"
            >
              <link.icon className="size-4" aria-hidden />
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
