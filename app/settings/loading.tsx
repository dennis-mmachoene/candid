import { Container } from '@/components/ui/container';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsLoading() {
  return (
    <main className="py-10 sm:py-14">
      <Container width="prose" aria-busy="true">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-8 w-56 max-w-full" />
          <Skeleton className="h-5 w-80 max-w-full" />
        </div>

        <div className="mt-10 flex flex-col gap-6">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-9 rounded-md" />
                  <Skeleton className="h-6 w-40" />
                </div>
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
