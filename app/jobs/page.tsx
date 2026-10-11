import Link from 'next/link';
import { Bookmark, Briefcase, MapPin, Search } from 'lucide-react';

import { SaveJobButton } from '@/components/save-job-button';
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
  searchParams: Promise<{ q?: string; saved?: string }>;
}) {
  await requireUser();

  const { q, saved } = await searchParams;
  const showingSaved = saved === '1';

  /*
   * Both at once.
   *
   * The second query is what tells each card whether to show a filled
   * bookmark. Running it in parallel with the list rather than after it costs
   * nothing: neither depends on the other, and awaited in sequence the page
   * would wait for the sum of two round trips to tell the person something
   * they could have had in the time of one.
   */
  const [jobs, savedIds] = await Promise.all([
    showingSaved ? jobRepository.listSavedJobs() : jobRepository.listJobs(q),
    jobRepository.savedJobIds(),
  ]);

  return (
    <main className="py-10 sm:py-14">
      <Container width="wide">
        <header className="animate-rise flex flex-col gap-2">
          <h1 className="text-fluid-2xl font-semibold tracking-tight">
            {showingSaved ? 'Your shortlist' : 'Open roles'}
          </h1>
          <p className="text-muted-foreground">
            {showingSaved
              ? 'Roles you kept. They stay here until you remove them, even if the employer closes the role.'
              : 'Pick one and apply with your CV, or let Candid tailor it first.'}
          </p>
        </header>

        {/*
          Two links rather than a tab widget.

          Which list you are looking at is in the address bar, so it survives a
          reload, it can be sent to someone, and the page stays a Server
          Component with nothing to hold on the client.
        */}
        <nav aria-label="Which roles to show" className="mt-6 flex gap-2">
          <Button asChild variant={showingSaved ? 'ghost' : 'secondary'} size="sm">
            <Link href="/jobs">All roles</Link>
          </Button>
          <Button asChild variant={showingSaved ? 'secondary' : 'ghost'} size="sm">
            <Link href="/jobs?saved=1">
              <Bookmark className="size-4" aria-hidden />
              Saved
              {savedIds.size > 0 ? (
                <span className="tabular-nums">{savedIds.size}</span>
              ) : null}
            </Link>
          </Button>
        </nav>

        {/*
          A plain GET form, so a search is a URL.

          That matters more than it looks. The result is linkable, the back
          button works, and the page stays a server component: there is no
          state to hold on the client, because the address bar is the state.

          It is hidden on the shortlist, because a shortlist is small enough to
          read and a search box that filtered it would be a second meaning for
          the same control.
        */}
        {showingSaved ? null : (
          <form method="GET" className="mt-4 flex gap-2">
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
        )}

        {jobs.length === 0 ? (
          <Card className="mt-6">
            <CardContent className="py-10 text-center">
              <p className="font-medium">
                {showingSaved
                  ? 'Nothing saved yet.'
                  : q
                    ? `Nothing matches "${q}".`
                    : 'No roles are open yet.'}
              </p>
              <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
                {showingSaved
                  ? 'Press the bookmark on any role to keep it here while you decide.'
                  : q
                    ? 'Try a shorter search, or clear it to see everything.'
                    : 'Once a recruiter posts a role it will appear here.'}
              </p>
              {showingSaved || q ? (
                <Button asChild variant="secondary" className="mt-4">
                  <Link href="/jobs">See every role</Link>
                </Button>
              ) : null}
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

                      <div className="flex shrink-0 items-center gap-2">
                        {/*
                          Only reachable on the shortlist: the board itself
                          lists open roles. A role saved and then closed still
                          belongs here, and saying so is better than dropping
                          it and looking like the save failed.
                        */}
                        {job.isOpen ? null : (
                          <Badge variant="blocked">Closed</Badge>
                        )}
                        <Badge variant="outline">
                          {job.createdAt.toLocaleDateString('en-ZA', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </Badge>
                        <SaveJobButton
                          jobId={job.id}
                          saved={savedIds.has(job.id)}
                        />
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
