import Link from 'next/link';
import { Briefcase, MapPin, Plus, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { requireSide } from '@/lib/guards';
import { jobRepository } from '@/lib/infrastructure/job-repo';

export const metadata = { title: 'Hiring' };

export default async function HiringPage() {
  const user = await requireSide('recruiter');

  // RLS returns only this recruiter's jobs. There is no filter here because
  // the policy already applied one.
  const jobs = await jobRepository.listMyJobs();
  const totalApplicants = jobs.reduce((sum, job) => sum + job.applicantCount, 0);

  return (
    <main className="py-10 sm:py-14">
      <Container width="wide">
        <header className="animate-rise flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-fluid-2xl font-semibold tracking-tight">
              Hiring, {user.firstName}
            </h1>
            <p className="text-muted-foreground">
              {jobs.length === 0
                ? 'Post a role and it appears on the board.'
                : `${jobs.length} role${jobs.length === 1 ? '' : 's'} posted, ${totalApplicants} application${totalApplicants === 1 ? '' : 's'}.`}
            </p>
          </div>
          <Button asChild>
            <Link href="/hiring/new">
              <Plus aria-hidden />
              Post a role
            </Link>
          </Button>
        </header>

        {jobs.length === 0 ? (
          <Card className="mt-6">
            <CardContent className="py-10 text-center">
              <p className="font-medium">Nothing posted yet.</p>
              <p className="text-muted-foreground mt-1 text-sm">
                A role needs a description people can be compared against, so
                write it properly rather than in one line.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {jobs.map((job) => (
              <li key={job.id}>
                <Card className="hover:border-brand-500/40 transition-colors">
                  <CardContent className="flex flex-wrap items-start justify-between gap-4 py-5">
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <h2 className="font-medium">
                        <Link
                          href={`/hiring/${job.id}`}
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
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      {job.isOpen ? null : <Badge variant="blocked">Closed</Badge>}
                      <Badge variant={job.applicantCount > 0 ? 'accepted' : 'outline'}>
                        <Users className="size-3" aria-hidden />
                        {job.applicantCount}
                      </Badge>
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/hiring/${job.id}`}>Applicants</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </main>
  );
}
