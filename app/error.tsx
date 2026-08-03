'use client';

import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';

/**
 * The route error boundary. Honest and plain: a clear sentence and a way
 * forward, never a stack trace and never a sad-emoji "Something went wrong".
 *
 * `error.digest` is a server-generated id for the real error, which stays in
 * the logs. We show nothing from the error object itself, because it can carry
 * detail that has no business on a stranger's screen.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Shape only — the message stays server-side.
    console.error('[route error]', { digest: error.digest });
  }, [error]);

  return (
    <main className="flex flex-col items-center py-24 text-center sm:py-32">
      <Container width="narrow">
        <span className="border-borderline/30 bg-borderline/10 mx-auto mb-6 grid size-14 place-items-center rounded-lg border">
          <RotateCcw className="text-borderline size-7" aria-hidden />
        </span>
        <h1 className="text-fluid-2xl font-semibold tracking-tight text-balance">
          That did not go through.
        </h1>
        <p className="text-muted-foreground mt-3 text-pretty leading-relaxed">
          Something on our side interrupted the last step. Your CV and your data
          are untouched. Try again, and if it keeps happening, come back in a few
          minutes.
        </p>
        <div className="mt-8 flex justify-center">
          <Button onClick={reset}>
            <RotateCcw className="size-4" aria-hidden />
            Try again
          </Button>
        </div>
      </Container>
    </main>
  );
}
