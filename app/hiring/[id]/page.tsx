import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download, FileText, Sparkles } from 'lucide-react';

import { ApplicantStatus } from '@/components/applicant-status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Card, CardContent } from '@/components/ui/card';
import { requireSide } from '@/lib/guards';
import { jobRepository } from '@/lib/infrastructure/job-repo';

export const metadata = { title: 'Applicants' };

export default async function ApplicantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSide('recruiter');
  const { id } = await params;

  const job = await jobRepository.getJob(id);

  /*
    Three answers to three different questions, and none of them is a repeat.

    `requireSide` above answers "is this half of the product yours". A job
    seeker who pastes this URL never gets this far. That matters, because they
    used to: the page rendered the employer's furniture around their own single
    application, down to a status dropdown on someone else's hire.

    Row-Level Security answers "what may you read". It is the reason that
    earlier mistake was ugly rather than dangerous. The policy on
    `applications` matches only rows whose job belongs to the caller, so the
    list was empty of everybody except the person reading it, and she is
    entitled to see her own application wherever it turns up.

    This line answers "is this role yours". An employer with a real account
    guessing another employer's job id has passed both checks above and still
    has no business here.

    `notFound`, and the same `notFound` as an id that does not exist. Anything
    else would confirm the role is real.
  */
  if (!job || job.recruiterId !== user.id) notFound();

  const applicants = await jobRepository.listApplicants(job.id);

  const tailored = applicants.filter((a) => a.mode === 'tailored').length;

  return (
    <main className="py-10 sm:py-14">
      <Container width="wide">
        <Link
          href="/hiring"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Your roles
        </Link>

        <header className="animate-rise mt-4 flex flex-col gap-2">
          <h1 className="text-fluid-2xl font-semibold tracking-tight">
            {job.title}
          </h1>
          <p className="text-muted-foreground">
            {applicants.length === 0
              ? 'Nobody has applied yet.'
              : `${applicants.length} applicant${applicants.length === 1 ? '' : 's'}, ${tailored} tailored for this role.`}
          </p>
        </header>

        {applicants.length === 0 ? (
          <Card className="mt-6">
            <CardContent className="py-10 text-center">
              <p className="font-medium">No applications yet.</p>
              <p className="text-muted-foreground mt-1 text-sm">
                The role is on the board. Applications appear here as they
                arrive.
              </p>
              <Button asChild variant="secondary" className="mt-4">
                <Link href={`/jobs/${job.id}`}>See it as a candidate does</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {applicants.map((applicant) => (
              <li key={applicant.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-start justify-between gap-4 py-5">
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <h2 className="font-medium">
                        {applicant.fullName ?? 'An applicant'}
                      </h2>
                      {applicant.headline ? (
                        <p className="text-muted-foreground text-sm">
                          {applicant.headline}
                        </p>
                      ) : null}
                      {applicant.location ? (
                        <p className="text-muted-foreground text-sm">
                          {applicant.location}
                        </p>
                      ) : null}
                      <p className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
                        {applicant.mode === 'tailored' ? (
                          <>
                            <Sparkles className="size-3.5" aria-hidden />
                            Tailored for this role
                          </>
                        ) : (
                          <>
                            <FileText className="size-3.5" aria-hidden />
                            Their CV as it stands
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <ApplicantStatus
                        applicationId={applicant.id}
                        jobId={job.id}
                        current={applicant.status}
                      />
                      <span className="text-muted-foreground text-xs">
                        {applicant.createdAt.toLocaleDateString('en-ZA', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      {/*
                        The export route serves exactly the document that was
                        submitted, and only because the applicant submitted it
                        to this job. The policy on tailored_resumes is what
                        allows this link to work, not this component.
                      */}
                      {applicant.tailoredResumeId ? (
                        <Button asChild size="sm" variant="secondary">
                          <a
                            href={`/api/export/${applicant.tailoredResumeId}?format=pdf`}
                          >
                            <Download aria-hidden />
                            Their CV
                          </a>
                        </Button>
                      ) : (
                        <Badge variant="outline">CV on file</Badge>
                      )}
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
