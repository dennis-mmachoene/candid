import Link from 'next/link';
import { Briefcase, MapPin, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { requireUser } from '@/lib/dal';
import { jobRepository } from '@/lib/infrastructure/job-repo';

export const metadata = { title: 'Jobs' };

/** "R45 000 - R60 000", or nothing when the recruiter did not say. */
function describePackage(min: number | null, max: number | null): string | null {
  const money = (value: number) => `R${value.toLocaleString('en-ZA')}`;
  if (min !== null && max !== null) return `${money(min)} - ${money(max)}`;
  if (min !== null) return `From ${money(min)}`;
  if (max !== null) return `Up to ${money(max)}`;
  return null;
}

export default async function JobsPage({
  searchParams,
}: {
  // Next 15 makes these async.
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();

  const { q } = await searchParams;
  const jobs = await jobRepository.listJobs(q);

  return (
    <main className="py-10 sm:py-14">
      <Container width="wide">
        <header className="animate-rise flex flex-col gap-2">
          <h1 className="text-fluid-2xl font-semibold tracking-tight">
            Open roles
          </h1>
          <p className="text-muted-foreground">
            Pick one and apply with your profile, or let Candid tailor it first.
          </p>
        </header>

        {/*
          A plain GET form, so a search is a URL.

          That matters more than it looks. The result is linkable, the back
          button works, and the page stays a server component: there is no
          state to hold on the client, because the address bar is the state.
        */}
        <form method="GET" className="mt-6 flex gap-2">
          <div className="relative flex-1">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              defaultValue={q ?? ''}
              placeholder="Title or city"
              aria-label="Search jobs by title or city"
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent py-2 pr-3 pl-9 text-sm outline-none focus-visible:ring-[3px]"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>

        {jobs.length === 0 ? (
          <Card className="mt-6">
            <CardContent className="py-10 text-center">
              <p className="font-medium">
                {q ? `Nothing matches "${q}".` : 'No roles are open yet.'}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                {q
                  ? 'Try a shorter search, or clear it to see everything.'
                  : 'Once a recruiter posts a role it will appear here.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {jobs.map((job) => {
              const pay = describePackage(job.packageMin, job.packageMax);
              return (
                <li key={job.id}>
                  <Card className="hover:border-brand-500/40 transition-colors">
                    <CardContent className="flex flex-wrap items-start justify-between gap-4 py-5">
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <h2 className="font-medium">
                          <Link
                            href={`/jobs/${job.id}`}
                            className="hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                          >
                            {job.title}
                          </Link>
                        </h2>
                        <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                          <span className="inline-flex items-center gap-1.5">
                            <Briefcase className="size-3.5" aria-hidden />
                            {job.companyName}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="size-3.5" aria-hidden />
                            {job.location}
                          </span>
                        </p>
                        {pay ? (
                          <p className="text-muted-foreground text-sm">{pay}</p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <Badge variant="outline">
                          {job.createdAt.toLocaleDateString('en-ZA', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </Badge>
                        <Button asChild size="sm">
                          <Link href={`/jobs/${job.id}`}>View</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </main>
  );
}
