import Link from 'next/link';
import { ArrowRight, FileText, ShieldCheck, Upload } from 'lucide-react';

import { DeleteResumeButton } from '@/components/delete-resume-button';

import { UploadForm } from '@/components/upload-form';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireConsentedUser } from '@/lib/dal';
import { resumeRepository } from '@/lib/infrastructure/supabase-repo';

export const metadata = { title: 'Your CVs' };

export default async function DashboardPage() {
  // The gate. A signed-out user is redirected, and a signed-in user who has
  // not accepted the current policy version goes to /consent. Both checks
  // happen here, next to the data, not in middleware.
  const user = await requireConsentedUser();

  // No user id passed and none needed: Row-Level Security scopes this to the
  // caller's own rows.
  const resumes = await resumeRepository.listResumes();

  const hasCvs = resumes.length > 0;

  return (
    <main className="py-10 sm:py-14">
      <Container width="wide">
      <header className="animate-rise flex flex-col gap-2">
        <h1 className="text-fluid-2xl font-semibold tracking-tight">
          {hasCvs ? `Welcome back, ${user.firstName}` : `Welcome, ${user.firstName}`}
        </h1>
        <p className="text-muted-foreground">
          {hasCvs
            ? 'Pick a CV and tailor it to an advert.'
            : 'Upload your CV to get started. It is de-identified the moment it arrives.'}
        </p>
      </header>

      {/*
        Your CVs come first, and the upload sits underneath.

        The old order had a large upload card and a four-point privacy
        explainer filling the screen, with the stored CVs below the fold. That
        is the right layout exactly once — the first visit. Every visit after
        it, the person is here to tailor a CV they have already given us, and
        they had to scroll past the explanation of a thing they did last week
        to reach it.

        The privacy note is now one line with a link. It is the third time this
        is being explained: the landing page says it, the consent gate says it,
        and repeating it in full here reads as a warning rather than a promise.
      */}
      {hasCvs ? (
        <section className="mt-8 flex flex-col gap-4 sm:mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-fluid-xl font-semibold tracking-tight">
              Your CVs
            </h2>
            <span className="text-muted-foreground text-sm tabular-nums">
              {resumes.length} stored
            </span>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {resumes.map((resume) => (
              <li key={resume.id}>
                <Card className="card-hover flex h-full flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle asChild className="min-w-0 text-base">
                        {/* The person's own filename. It is the only label they
                            recognise, and three cards reading "DOCX CV" were
                            indistinguishable. */}
                        <h3 className="break-anywhere flex items-start gap-2">
                          <FileText
                            className="text-brand-600 dark:text-brand-300 mt-0.5 size-4 shrink-0"
                            aria-hidden
                          />
                          {resume.originalFilename ?? `${resume.format.toUpperCase()} CV`}
                        </h3>
                      </CardTitle>
                      <Badge variant="accepted" className="shrink-0">
                        <ShieldCheck className="size-3" aria-hidden />
                        de-identified
                      </Badge>
                    </div>
                    <CardDescription>
                      Uploaded{' '}
                      {resume.createdAt.toLocaleDateString('en-ZA', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex flex-1 flex-col gap-4">
                    {/*
                      Rendered as prose rather than in a monospace block.

                      The stored text is a CV, and showing it in a terminal font
                      made a successful upload look like a parser error — which
                      is a bad thing to feel about the one screen that is meant
                      to reassure you the file was read properly.
                    */}
                    <p
                      data-testid="cv-preview"
                      className="text-muted-foreground line-clamp-4 flex-1 text-sm leading-relaxed"
                    >
                      {resume.content.replace(/\s+/g, ' ').slice(0, 220)}
                      {resume.content.length > 220 ? '…' : ''}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Button asChild size="sm">
                        <Link href={`/tailor/${resume.id}`}>
                          Tailor to a job advert
                          <ArrowRight className="size-4" aria-hidden />
                        </Link>
                      </Button>
                      <DeleteResumeButton
                        id={resume.id}
                        label={resume.originalFilename ?? 'this CV'}
                      />
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={hasCvs ? 'mt-12' : 'mt-8 sm:mt-10'}>
        <Card>
          <CardHeader>
            <span className="border-brand-500/25 bg-brand-500/10 mb-1 grid size-11 place-items-center rounded-md border">
              <Upload className="text-brand-700 dark:text-brand-300 size-5" aria-hidden />
            </span>
            <CardTitle asChild className="text-fluid-lg">
              <h2>{hasCvs ? 'Upload another CV' : 'Upload your CV'}</h2>
            </CardTitle>
            <CardDescription>
              PDF or Word, up to 5 MB. Your name, contact details and any ID
              number are removed before anything is stored, and the original
              file is discarded.{' '}
              <Link
                href="/privacy"
                className="underline underline-offset-4"
              >
                What happens to your file
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UploadForm />
          </CardContent>
        </Card>
      </section>
      </Container>
    </main>
  );
}
