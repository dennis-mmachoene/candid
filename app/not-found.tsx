import Link from 'next/link';
import { Compass } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';

export const metadata = { title: 'Page not found' };

/**
 * A plain, human 404. `notFound()` in the review and tailor routes lands here
 * when an id does not exist — which, thanks to Row-Level Security, is also what
 * someone else's CV looks like. So the copy stays neutral: it does not say
 * "you are not allowed", because that would confirm the id is real.
 */
export default function NotFound() {
  return (
    <main className="flex flex-col items-center py-24 text-center sm:py-32">
      <Container width="narrow">
        <span className="border-brand-500/25 bg-brand-500/10 mx-auto mb-6 grid size-14 place-items-center rounded-lg border">
          <Compass
            className="text-brand-700 dark:text-brand-300 size-7"
            aria-hidden
          />
        </span>
        <h1 className="text-fluid-2xl font-semibold tracking-tight text-balance">
          We could not find that page.
        </h1>
        <p className="text-muted-foreground mt-3 text-pretty leading-relaxed">
          The link may be old, or the CV it pointed to may have been deleted.
          Nothing is wrong on your side.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/dashboard">Go to your CVs</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back to the start</Link>
          </Button>
        </div>
      </Container>
    </main>
  );
}
