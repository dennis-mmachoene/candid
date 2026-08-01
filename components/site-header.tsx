import Link from 'next/link';
import { History, Settings, ShieldCheck } from 'lucide-react';

import { signOut } from '@/app/actions/auth';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { getVerifiedUser } from '@/lib/dal';

/**
 * The header is a Server Component so it can read the verified session
 * directly. The alternative — passing a `signedIn` prop down from every page —
 * would mean each page deciding what the header knows, which is how a page
 * eventually forgets and shows the wrong thing.
 */
export async function SiteHeader() {
  const user = await getVerifiedUser();

  return (
    <header className="glass sticky top-0 z-50 w-full border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href={user ? '/dashboard' : '/'}
          className="group flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span className="gradient-brand shadow-soft grid size-8 place-items-center rounded-lg transition-transform duration-300 group-hover:scale-105">
            <ShieldCheck className="size-4 text-white" aria-hidden />
          </span>
          <span className="text-base font-semibold tracking-tight">Candid</span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {user ? (
            <>
              <span className="text-muted-foreground hidden text-sm sm:inline">
                Hi, {user.firstName}
              </span>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/history">
                  <History className="size-4" aria-hidden />
                  <span className="hidden sm:inline">History</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/settings">
                  <Settings className="size-4" aria-hidden />
                  <span className="hidden sm:inline">Settings</span>
                </Link>
              </Button>
              <ThemeToggle />
              <form action={signOut}>
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                <Link href="/#how">How it works</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                <Link href="/#promises">Our promises</Link>
              </Button>
              <ThemeToggle />
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
