import { Container } from '@/components/ui/container';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shown while the stored profile is read.
 *
 * Two columns from `lg`, matching the page: the form on the left and the
 * printed-header preview on the right. The field rows are drawn at their real
 * heights so the first input does not move under the cursor when the values
 * arrive.
 */
export default function ProfileLoading() {
  return (
    <main className="py-10 sm:py-14">
      <Container width="wide" aria-busy="true">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-52 max-w-full" />
          <Skeleton className="h-5 w-full max-w-2xl" />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <Skeleton className="size-9 rounded-lg" />
                <Skeleton className="h-6 w-32" />
              </div>
              <Skeleton className="h-4 w-full max-w-md" />
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {[0, 1].map((i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              ))}
              <div className="grid gap-5 sm:grid-cols-2">
                {[0, 1].map((i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-9 w-full rounded-lg" />
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
              <Skeleton className="mt-1 h-9 w-20 rounded-lg" />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-28 w-full rounded-lg" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="mb-1 size-9 rounded-lg" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-full rounded-lg" />
              </CardContent>
            </Card>
          </div>
        </div>
      </Container>
    </main>
  );
}
