import Link from 'next/link';
import {
  Briefcase,
  FileText,
  History,
  Search,
  Send,
  Settings,
  ShieldCheck,
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
 * Signed in, it carries five things. That fits from `sm` upward; below it, the
 * navigation collapses into `MobileNav` and only the theme toggle and sign out
 * stay visible.
 */
export async function SiteHeader() {
  const user = await getVerifiedUser();

  // Only asked for when somebody is signed in. A signed-out visitor has no
  // role and no reason for a query.
  const role = user ? await jobRepository.getRole() : null;

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
              <span className="text-muted-foreground hidden truncate text-sm lg:inline">
                Hi, {user.firstName}
              </span>

              {/*
                The role decides what the header offers.

                A candidate has no use for "Hiring" and a recruiter has no use
                for "My applications". Showing both and letting the database
                refuse one of them is how an interface teaches people that half
                of it is not for them.
              */}
              <div className="hidden items-center gap-1 sm:flex">
                {role === 'recruiter' ? (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/hiring">
                      <Briefcase className="size-4" aria-hidden />
                      <span className="hidden md:inline">Hiring</span>
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/jobs">
                        <Search className="size-4" aria-hidden />
                        <span className="hidden md:inline">Jobs</span>
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/applications">
                        <Send className="size-4" aria-hidden />
                        <span className="hidden md:inline">Applications</span>
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/dashboard">
                        <FileText className="size-4" aria-hidden />
                        <span className="hidden md:inline">My CV</span>
                      </Link>
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/history">
                    <History className="size-4" aria-hidden />
                    <span className="hidden md:inline">History</span>
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/settings">
                    <Settings className="size-4" aria-hidden />
                    <span className="hidden md:inline">Settings</span>
                  </Link>
                </Button>
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
