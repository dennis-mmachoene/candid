import { Container } from '@/components/ui/container';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shown while the board is read.
 *
 * It mirrors the real page: heading, the search row, then a column of role
 * cards. A skeleton that shows a different shape from the page it precedes
 * makes the arrival of content a jump rather than a fill, which is worse than
 * showing nothing.
 *
 * Four rows rather than three. The seeded board has six, and a skeleton that
 * is shorter than the content it stands in for makes the page grow downward as
 * it loads, which moves whatever the person was about to click.
 */
export default function JobsLoading() {
  return (
    <main className="py-10 sm:py-14">
      <Container width="wide" aria-busy="true">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-48 max-w-full" />
          <Skeleton className="h-5 w-96 max-w-full" />
        </div>

        <div className="mt-6 flex gap-2">
          <Skeleton className="h-9 flex-1 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="flex flex-wrap items-start justify-between gap-4 py-5">
                <div className="flex min-w-0 flex-col gap-2">
                  <Skeleton className="h-5 w-56 max-w-full" />
                  <Skeleton className="h-4 w-64 max-w-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-8 w-16 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </main>
  );
}
