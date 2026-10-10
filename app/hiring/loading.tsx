import { Container } from '@/components/ui/container';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shown while the recruiter's own roles are read.
 *
 * The "Post a role" button is drawn as a skeleton rather than rendered for
 * real. A live button on a loading page is worse than a grey block: it invites
 * a click on a screen whose state nobody knows yet, and the navigation it
 * starts races the one already in flight.
 */
export default function HiringLoading() {
  return (
    <main className="py-10 sm:py-14">
      <Container width="wide" aria-busy="true">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-56 max-w-full" />
            <Skeleton className="h-5 w-72 max-w-full" />
          </div>
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="flex flex-wrap items-start justify-between gap-4 py-5">
                <div className="flex min-w-0 flex-col gap-2">
                  <Skeleton className="h-5 w-52 max-w-full" />
                  <Skeleton className="h-4 w-64 max-w-full" />
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Skeleton className="h-5 w-12 rounded-full" />
                  <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Container>
    </main>
  );
}
