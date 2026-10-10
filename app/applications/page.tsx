import Link from 'next/link';
import { CheckCircle2, FileText, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Card, CardContent } from '@/components/ui/card';
import { requireUser } from '@/lib/dal';
import { jobRepository, type ApplicationStatus } from '@/lib/infrastructure/job-repo';

export const metadata = { title: 'Your applications' };

/**
 * Plain words, not database words.
 *
 * "Rejected" is the status an employer sets. "Not taken forward" is what the
 * person reads. The first is accurate and the second is the same fact without
 * the tone, which matters on a page somebody opens hoping for good news.
 */
const STATUS: Record<ApplicationStatus, { label: string; variant: 'default' | 'outline' | 'accepted' | 'borderline' | 'blocked' }> = {
  submitted: { label: 'Sent', variant: 'outline' },
  reviewing: { label: 'Being reviewed', variant: 'borderline' },
  shortlisted: { label: 'Shortlisted', variant: 'accepted' },
  rejected: { label: 'Not taken forward', variant: 'default' },
  hired: { label: 'Hired', variant: 'accepted' },
};

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ applied?: string }>;
}) {
  const user = await requireUser();
  const { applied } = await searchParams;

  const applications = await jobRepository.myApplications();

  return (
    <main className="py-10 sm:py-14">
      <Container width="wide">
        <header className="animate-rise flex flex-col gap-2">
          <h1 className="text-fluid-2xl font-semibold tracking-tight">
            Your applications
          </h1>
          <p className="text-muted-foreground">
            {applications.length === 0
              ? `Nothing sent yet, ${user.firstName}.`
              : `${applications.length} sent.`}
          </p>
        </header>

        {applied ? (
          <p
            role="status"
            className="border-accepted/40 bg-accepted-surface/40 animate-fade mt-6 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
          >
            <CheckCircle2 className="text-accepted mt-0.5 size-4 shrink-0" aria-hidden />
            Application sent.
          </p>
        ) : null}

        {applications.length === 0 ? (
          <Card className="mt-6">
            <CardContent className="py-10 text-center">
              <p className="font-medium">No applications yet.</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Find a role and apply with your CV, or tailor it first.
              </p>
              <Button asChild className="mt-4">
                <Link href="/jobs">Browse roles</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {applications.map((application) => {
              const status = STATUS[application.status];
              return (
                <li key={application.id}>
                  <Card>
                    <CardContent className="flex flex-wrap items-start justify-between gap-4 py-5">
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <h2 className="font-medium">
                          <Link
                            href={`/jobs/${application.jobId}`}
                            className="hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                          >
                            {application.jobTitle}
                          </Link>
                        </h2>
                        <p className="text-muted-foreground text-sm">
                          {application.companyName}
                        </p>
                        <p className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
                          {application.mode === 'tailored' ? (
                            <>
                              <Sparkles className="size-3.5" aria-hidden />
                              Tailored for this role
                            </>
                          ) : (
                            <>
                              <FileText className="size-3.5" aria-hidden />
                              Your CV as it stands
                            </>
                          )}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <Badge variant={status.variant}>{status.label}</Badge>
                        <span className="text-muted-foreground text-xs">
                          {application.createdAt.toLocaleDateString('en-ZA', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                        {/*
                          The integrity report stays reachable after the fact.
                          If somebody is asked about a line in an interview,
                          the evidence for it should not have disappeared when
                          they pressed send.
                        */}
                        {application.tailoredResumeId ? (
                          <Link
                            href={`/review/${application.tailoredResumeId}`}
                            className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4 transition-colors"
                          >
                            What was kept and refused
                          </Link>
                        ) : null}
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
