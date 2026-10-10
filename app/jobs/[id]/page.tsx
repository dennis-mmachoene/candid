import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Briefcase, CheckCircle2, MapPin } from 'lucide-react';

import { ApplyPanel } from '@/components/apply-panel';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/ui/container';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireUser } from '@/lib/dal';
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
  await requireUser();
  const { id } = await params;

  // RLS scopes this. A job that is closed and not yours is indistinguishable
  // from one that does not exist.
  const job = await jobRepository.getJob(id);
  if (!job) notFound();

  const [existing, resumes] = await Promise.all([
    jobRepository.existingApplication(job.id),
    resumeRepository.listResumes(),
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
          <h1 className="text-fluid-2xl font-semibold tracking-tight">
            {job.title}
          </h1>
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
              <h2>{existing ? 'You applied to this' : 'Apply'}</h2>
            </CardTitle>
            {existing ? (
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
            {existing ? (
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
