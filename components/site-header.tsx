import Link from 'next/link';
import {
  Briefcase,
  FileText,
  History,
  Search,
  Send,
  Settings,
  ShieldCheck,
  User,
} from 'lucide-react';

import { signOut } from '@/app/actions/auth';
import { MobileNav } from '@/components/mobile-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { getVerifiedUser } from '@/lib/dal';
import { jobRepository } from '@/lib/infrastructure/job-repo';

/**
 * The header is a Server Component so it can read the verified session
 * directly. The alternative — passing a `signedIn` prop down from every page —
 * would mean each page deciding what the header knows, which is how a page
 * eventually forgets and shows the wrong thing.
 *
 * A solid, opaque bar over a single hairline: no frosted glass, no blur over a
 * coloured blob. It stays out of the way, which is the job of chrome.
 *
 * Below `sm` the navigation collapses into `MobileNav` and only the theme
 * toggle and sign out stay visible.
 */

/**
 * The links, by side of the hire.
 *
 * A list rather than six copies of the same markup. There are now enough of
 * them that an inline version was six near-identical blocks, which is how one
 * of them quietly ends up with a different size or a missing label.
 */
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

export async function SiteHeader() {
  const user = await getVerifiedUser();

  // Only asked for when somebody is signed in. A signed-out visitor has no
  // role and no reason for a query.
  const role = user ? await jobRepository.getRole() : null;

  const links = [
    ...(role === 'recruiter' ? RECRUITER_LINKS : CANDIDATE_LINKS),
    ...SHARED_LINKS,
  ];

  return (
    <header className="bg-background sticky top-0 z-50 w-full border-b">
      <Container className="flex h-16 items-center justify-between gap-3">
        <Link
          href={user ? '/dashboard' : '/'}
          className="group focus-visible:ring-ring/60 flex shrink-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-[3px]"
        >
          <span className="border-brand-500/30 bg-brand-500/10 grid size-8 shrink-0 place-items-center rounded-md border">
            <ShieldCheck
              className="text-brand-700 dark:text-brand-300 size-4"
              aria-hidden
            />
          </span>
          <span className="font-display text-base font-semibold tracking-tight">
            Candid
          </span>
        </Link>

        <nav className="flex min-w-0 items-center gap-1 sm:gap-2">
          {user ? (
            <>
              {/* Greeting only where there is room for it. */}
              <span className="text-muted-foreground hidden truncate text-sm 2xl:inline">
                Hi, {user.firstName}
              </span>

              {/*
                The role decides what the header offers.

                A candidate has no use for "Hiring" and a recruiter has no use
                for "My applications". Showing both and letting the database
                refuse one of them is how an interface teaches people that half
                of it is not for them.

                Labels appear from `xl`, not `md`. Six labelled buttons plus a
                greeting, the logo, the theme toggle and sign out overflow a
                1024px bar, and this row does not wrap: it would push sign out
                off the edge rather than onto a second line.

                `aria-label` on every link, because between `sm` and `xl` the
                label span is hidden and the link is an icon with no text in
                it. Without this, a screen reader reaches six links in a row
                and announces each of them as nothing at all.
              */}
              <div className="hidden items-center gap-1 sm:flex">
                {links.map((link) => (
                  <Button key={link.href} variant="ghost" size="sm" asChild>
                    <Link href={link.href} aria-label={link.label}>
                      <link.icon className="size-4" aria-hidden />
                      <span className="hidden xl:inline">{link.label}</span>
                    </Link>
                  </Button>
                ))}
              </div>

              <MobileNav email={user.email} role={role} />
              <ThemeToggle />

              <form action={signOut}>
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="hidden sm:inline-flex"
              >
                <Link href="/#how">How it works</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="hidden md:inline-flex"
              >
                <Link href="/#promises">Our promises</Link>
              </Button>
              <ThemeToggle />
            </>
          )}
        </nav>
      </Container>
    </header>
  );
}
