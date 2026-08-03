import { Container } from '@/components/ui/container';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The review screen assembles the integrity report before it renders. This
 * holds its shape — the header, the reassurance strip, and the three verdict
 * sections — so the most important screen in the product arrives calmly.
 */
export default function ReviewLoading() {
  return (
    <main className="py-10 sm:py-14">
      <Container width="prose" aria-busy="true">
        <Skeleton className="h-4 w-32" />

        <div className="mt-6 flex flex-col gap-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-9 w-full max-w-lg" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>

        <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-6">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-9 rounded-md" />
                  <Skeleton className="h-6 w-44" />
                </div>
                <Skeleton className="h-4 w-full max-w-md" />
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-10/12" />
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </main>
  );
}
