import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Briefcase, CheckCircle2, MapPin } from 'lucide-react';

import { ApplyPanel } from '@/components/apply-panel';
import { SaveJobButton } from '@/components/save-job-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireChosenSide } from '@/lib/guards';
import { jobRepository } from '@/lib/infrastructure/job-repo';
import { resumeRepository } from '@/lib/infrastructure/supabase-repo';

export const metadata = { title: 'Job' };

function describePackage(min: number | null, max: number | null): string | null {
  const money = (value: number) => `R${value.toLocaleString('en-ZA')}`;
  if (min !== null && max !== null) return `${money(min)} - ${money(max)}`;
  if (min !== null) return `From ${money(min)}`;
  if (max !== null) return `Up to ${money(max)}`;
  return null;
}

const STATUS_WORDS: Record<string, string> = {
  submitted: 'Submitted',
  reviewing: 'Being reviewed',
  shortlisted: 'Shortlisted',
  rejected: 'Not taken forward',
  hired: 'Hired',
};

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, role } = await requireChosenSide();
  const { id } = await params;

  // RLS scopes this. A job that is closed and not yours is indistinguishable
  // from one that does not exist.
  const job = await jobRepository.getJob(id);
  if (!job) notFound();

  /*
    This is the one page that serves both sides, and the only reason is the
    link that says "See it as a candidate does" on the applicants page. An
    employer wrote this advert, and reading back exactly what a job seeker
    reads is a thing they should be able to do.

    Any other advert is not theirs to browse. The board is where people look
    for work, and an employer wandering through it is on the wrong side of the
    product rather than on a secret page, so they are sent to their own roles.
  */
  const isOwnJob = job.recruiterId === user.id;
  if (role === 'recruiter' && !isOwnJob) redirect('/hiring');

  const [existing, resumes, savedIds] = await Promise.all([
    jobRepository.existingApplication(job.id),
    resumeRepository.listResumes(),
    jobRepository.savedJobIds(),
  ]);

  const pay = describePackage(job.packageMin, job.packageMax);

  return (
    <main className="py-10 sm:py-14">
      <Container width="prose">
        <Link
          href="/jobs"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All roles
        </Link>

        <header className="animate-rise mt-4 flex flex-col gap-3">
          {/*
            Save sits beside the title rather than next to Apply.

            Saving and applying are opposite decisions. One is "not now", the
            other is irreversible, and putting them side by side invites the
            wrong click. This one belongs with the role's name, which is what
            the person is deciding about.
          */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-fluid-2xl font-semibold tracking-tight">
              {job.title}
            </h1>
            {isOwnJob ? null : (
              <SaveJobButton
                jobId={job.id}
                saved={savedIds.has(job.id)}
                withLabel
              />
            )}
          </div>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="size-4" aria-hidden />
              {job.companyName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden />
              {job.location}
            </span>
          </p>
          {pay ? <p className="font-medium">{pay}</p> : null}
          {!job.isOpen ? (
            <Badge variant="blocked" className="self-start">
              Closed
            </Badge>
          ) : null}
        </header>

        {/* --- Apply, or what happened last time you did ------------------- */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle asChild className="text-fluid-lg">
              <h2>
                {isOwnJob
                  ? 'This is your role'
                  : existing
                    ? 'You applied to this'
                    : 'Apply'}
              </h2>
            </CardTitle>
            {isOwnJob ? (
              <CardDescription>
                You posted it. Everything below this card is what a candidate
                reads before they decide.
              </CardDescription>
            ) : existing ? (
              <CardDescription>
                Sent{' '}
                {existing.createdAt.toLocaleDateString('en-ZA', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                , {existing.mode === 'tailored' ? 'tailored for this role' : 'as your CV stands'}.
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
            {isOwnJob ? (
              <Button asChild variant="secondary">
                <Link href={`/hiring/${job.id}`}>See who has applied</Link>
              </Button>
            ) : existing ? (
              <p className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="text-accepted size-4 shrink-0" aria-hidden />
                <span>{STATUS_WORDS[existing.status] ?? existing.status}</span>
              </p>
            ) : job.isOpen ? (
              <ApplyPanel jobId={job.id} hasCv={resumes.length > 0} />
            ) : (
              <p className="text-muted-foreground text-sm">
                This role is closed, so it is not taking applications.
              </p>
            )}
          </CardContent>
        </Card>

        {/* --- The advert -------------------------------------------------- */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle asChild className="text-fluid-lg">
              <h2>About the role</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/*
              `whitespace-pre-wrap` rather than a markdown renderer.

              A job description is untrusted text written by another user. It is
              displayed as the characters it is, so nothing in it can become
              markup on somebody else's screen. The same text is what reaches
              the model, fenced as data, for the same reason.
            */}
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {job.description}
            </p>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle asChild className="text-fluid-lg">
              <h2>What it asks for</h2>
            </CardTitle>
            <CardDescription>
              This is what your CV gets compared against.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {job.requirements}
            </p>
          </CardContent>
        </Card>
      </Container>
    </main>
  );
}
