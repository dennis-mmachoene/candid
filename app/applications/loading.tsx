import { Container } from '@/components/ui/container';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shown while the applications are read.
 *
 * Each row carries the role on the left and the status on the right, so the
 * skeleton does too. The status column is the reason anybody opens this page,
 * and a skeleton that leaves it out would move the one thing being looked for
 * the moment the data lands.
 */
export default function ApplicationsLoading() {
  return (
    <main className="py-10 sm:py-14">
      <Container width="wide" aria-busy="true">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-60 max-w-full" />
          <Skeleton className="h-5 w-40" />
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="flex flex-wrap items-start justify-between gap-4 py-5">
                <div className="flex min-w-0 flex-col gap-2">
                  <Skeleton className="h-5 w-56 max-w-full" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Skeleton className="h-5 w-28 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </main>
  );
}
