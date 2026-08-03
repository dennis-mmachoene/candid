import { Container } from '@/components/ui/container';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function TailorLoading() {
  return (
    <main className="py-10 sm:py-14">
      <Container width="prose" aria-busy="true">
        <Skeleton className="h-4 w-32" />

        <div className="mt-6 flex flex-col gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-5 w-full max-w-md" />
        </div>

        <div className="mt-8 flex flex-col gap-6">
          <Card>
            <CardContent className="flex items-start gap-3 pt-6">
              <Skeleton className="size-9 shrink-0 rounded-md" />
              <div className="flex w-full flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-9/12" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-full max-w-md" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-48 w-full rounded-lg" />
              <Skeleton className="h-12 w-40 rounded-lg" />
            </CardContent>
          </Card>
        </div>
      </Container>
    </main>
  );
}
