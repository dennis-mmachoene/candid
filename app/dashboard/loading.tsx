import { Container } from '@/components/ui/container';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shown while the dashboard reads the signed-in user's stored CVs. It keeps the
 * shape of the real page — a heading, the two top cards, a grid below — so the
 * arrival of content is a fill, not a jump.
 */
export default function DashboardLoading() {
  return (
    <main className="py-10 sm:py-14">
      <Container width="wide" aria-busy="true">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>

        <div className="mt-8 grid gap-5 sm:mt-10 sm:gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-start">
          {[0, 1].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="mb-1 size-11 rounded-md" />
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-56 max-w-full" />
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-9/12" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-4">
          <Skeleton className="h-6 w-40" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-40 max-w-full" />
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <Skeleton className="h-20 w-full rounded-lg" />
                  <Skeleton className="h-8 w-40" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </Container>
    </main>
  );
}
