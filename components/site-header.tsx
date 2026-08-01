import Link from 'next/link';
import { History, Settings, ShieldCheck } from 'lucide-react';

import { signOut } from '@/app/actions/auth';
import { MobileNav } from '@/components/mobile-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { getVerifiedUser } from '@/lib/dal';

/**
 * The header is a Server Component so it can read the verified session
 * directly. The alternative — passing a `signedIn` prop down from every page —
 * would mean each page deciding what the header knows, which is how a page
 * eventually forgets and shows the wrong thing.
 *
 * Signed in, it carries five things. That fits from `sm` upward; below it, the
 * navigation collapses into `MobileNav` and only the theme toggle and sign out
 * stay visible.
 */
export async function SiteHeader() {
  const user = await getVerifiedUser();

  return (
    <header className="glass sticky top-0 z-50 w-full border-b">
      <Container className="flex h-16 items-center justify-between gap-3">
        <Link
          href={user ? '/dashboard' : '/'}
          className="group focus-visible:ring-ring/50 flex shrink-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-[3px]"
        >
          <span className="gradient-brand shadow-soft grid size-8 shrink-0 place-items-center rounded-lg transition-transform duration-300 group-hover:scale-105">
            <ShieldCheck className="size-4 text-white" aria-hidden />
          </span>
          <span className="text-base font-semibold tracking-tight">Candid</span>
        </Link>

        <nav className="flex min-w-0 items-center gap-1 sm:gap-2">
          {user ? (
            <>
              {/* Greeting only where there is room for it. */}
              <span className="text-muted-foreground hidden truncate text-sm lg:inline">
                Hi, {user.firstName}
              </span>

              <div className="hidden items-center gap-1 sm:flex">
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

              <MobileNav email={user.email} />
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
