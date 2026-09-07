import { Container } from '@/components/ui/container';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shown while the dashboard reads the signed-in user's stored CVs.
 *
 * It mirrors the real page: a heading, the grid of CVs, then the upload card
 * underneath. A skeleton that shows a different shape from the page it precedes
 * makes the arrival of content a jump rather than a fill, which is worse than
 * showing nothing.
 */
export default function DashboardLoading() {
  return (
    <main className="py-10 sm:py-14">
      <Container width="wide" aria-busy="true">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:mt-10">
          <div className="flex items-baseline justify-between gap-3">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <Skeleton className="h-5 w-40 max-w-full" />
                    <Skeleton className="h-5 w-24 shrink-0 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-36" />
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-8/12" />
                  <Skeleton className="mt-1 h-8 w-44" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mt-12">
          <Card>
            <CardHeader>
              <Skeleton className="mb-1 size-11 rounded-md" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full max-w-lg" />
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-9 w-48" />
            </CardContent>
          </Card>
        </div>
      </Container>
    </main>
  );
}
