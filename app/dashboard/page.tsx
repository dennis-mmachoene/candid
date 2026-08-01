import Link from 'next/link';
import { ArrowRight, FileText, ShieldCheck, Upload } from 'lucide-react';

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

  return (
    <main className="py-10 sm:py-14">
      <Container width="wide">
      <header className="animate-rise flex flex-col gap-2">
        <Badge variant="brand">Your workspace</Badge>
        <h1 className="text-fluid-2xl font-semibold tracking-tight">
          {resumes.length === 0
            ? `Welcome, ${user.firstName}`
            : `Welcome back, ${user.firstName}`}
        </h1>
        <p className="text-muted-foreground">
          {resumes.length === 0
            ? 'Upload your CV to get started. It is de-identified the moment it arrives.'
            : 'Upload once, then tailor it to as many adverts as you like.'}
        </p>
      </header>

      <div className="mt-8 grid gap-5 sm:mt-10 sm:gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <Card className="card-hover">
          <CardHeader>
            <span className="gradient-brand shadow-soft mb-1 grid size-11 place-items-center rounded-xl">
              <Upload className="size-5 text-white" aria-hidden />
            </span>
            <CardTitle asChild className="text-fluid-lg">
              <h2>Upload a CV</h2>
            </CardTitle>
            <CardDescription>
              It is de-identified the moment it arrives. Only the experience,
              skills and education part is stored.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UploadForm />
          </CardContent>
        </Card>

        <Card className="border-accepted/25 bg-accepted-surface/25">
          <CardHeader>
            <span className="border-accepted/30 bg-accepted/10 mb-1 grid size-11 place-items-center rounded-xl border">
              <ShieldCheck className="text-accepted size-5" aria-hidden />
            </span>
            <CardTitle asChild className="text-fluid-lg">
              <h2>What happens to your file</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="text-muted-foreground flex flex-col gap-3 text-sm leading-relaxed">
              <li className="flex gap-3">
                <span className="text-accepted font-mono text-xs">01</span>
                Your name, email and phone are lifted out and encrypted
                separately.
              </li>
              <li className="flex gap-3">
                <span className="text-accepted font-mono text-xs">02</span>
                Any South African ID number is redacted and thrown away. It is
                never stored.
              </li>
              <li className="flex gap-3">
                <span className="text-accepted font-mono text-xs">03</span>
                The original file is discarded. Only the de-identified text is
                kept.
              </li>
              <li className="flex gap-3">
                <span className="text-accepted font-mono text-xs">04</span>
                Your skills are recorded as the list every future claim gets
                checked against.
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>

      <section className="mt-14 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-fluid-xl font-semibold tracking-tight">Stored CVs</h2>
          {resumes.length > 0 ? (
            <span className="text-muted-foreground text-sm tabular-nums">
              {resumes.length} stored
            </span>
          ) : null}
        </div>

        {resumes.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <FileText className="text-muted-foreground/50 size-8" aria-hidden />
              <p className="font-medium">Nothing here yet</p>
              <p className="text-muted-foreground max-w-sm text-sm">
                Upload a CV above and it will appear here, ready to tailor
                against any advert.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {resumes.map((resume) => (
              <li key={resume.id}>
                <Card className="card-hover h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="text-brand-600 dark:text-brand-300 size-4" aria-hidden />
                        {resume.format.toUpperCase()} CV
                      </CardTitle>
                      <Badge variant="accepted">
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
                  <CardContent className="flex flex-col gap-4">
                    <pre className="bg-muted/60 text-muted-foreground break-anywhere max-h-28 overflow-hidden rounded-lg p-3 font-mono text-[0.7rem] leading-relaxed whitespace-pre-wrap">
                      {resume.content.slice(0, 260)}
                      {resume.content.length > 260 ? '…' : ''}
                    </pre>
                    <Button asChild size="sm" className="self-start">
                      <Link href={`/tailor/${resume.id}`}>
                        Tailor to a job advert
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Container>
    </main>
  );
}
