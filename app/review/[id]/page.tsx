import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen, ExternalLink, FileText } from 'lucide-react';

import { ExportPanel } from '@/components/export-panel';
import { SubmitApplication } from '@/components/submit-application';
import { IntegrityReport } from '@/components/integrity-report';
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
import { resourcesForGap } from '@/lib/domain/learning';
import { assembleResumeDocument } from '@/lib/domain/resume-document';
import { jobRepository } from '@/lib/infrastructure/job-repo';
import { resumeRepository } from '@/lib/infrastructure/supabase-repo';
import { createClient } from '@/lib/infrastructure/supabase/server';
import type { IntegrityReport as Report } from '@/lib/domain/types';

export const metadata = { title: 'Review' };

/**
 * No `loading.tsx` beside this file, for the same reason as the tailor route.
 *
 * A Suspense boundary at the segment level flushes the shell before this
 * component runs, which commits HTTP 200 and makes the later `notFound()`
 * cosmetic. Another user's tailoring would answer 200 rather than 404.
 *
 * If this page ever becomes slow enough to need a skeleton, wrap the slow
 * subtree in an explicit <Suspense> *below* the ownership check on line 34,
 * not at the segment level.
 */
export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ job?: string }>;
}) {
  const { id } = await params;
  const { job: jobId } = await searchParams;
  // The gate. The greeting that used to need the name is now a plain summary.
  await requireUser();

  const tailoring = await resumeRepository.getTailoring(id);
  if (!tailoring) notFound();

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('default_template')
    .maybeSingle();

  const report = tailoring.report as Report;
  const approved = new Set(tailoring.approvedClaims);

  // Assembled here purely to show the user what would be printed. The same
  // function produces the export in Phase 4, so what is previewed and what is
  // downloaded cannot drift apart.
  // The same uploaded CV the export reads, so the preview shows the carried
  // sections too and what is on screen matches what downloads.
  const resume = await resumeRepository.getResume(tailoring.resumeId);

  // Present only when the applicant arrived here from a job. Reviewing an old
  // tailoring from the history page has nothing to send.
  const job = jobId ? await jobRepository.getJob(jobId) : null;

  // The header the preview prints. Nothing is withheld from the applicant
  // about their own CV any more, so what is on screen is what downloads.
  const header = await resumeRepository.getProfileHeader();

  const { document, omissions } = assembleResumeDocument({
    identity: header ?? {
      fullName: null,
      headline: null,
      email: null,
      phone: null,
      location: null,
      links: [],
    },
    draft: tailoring.draft,
    report,
    approved,
    sourceCv: resume?.content,
  });

  return (
    <main className="py-10 sm:py-14">
      <Container width="prose">
      <Link
        href={jobId ? `/jobs/${jobId}` : '/dashboard'}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {jobId ? 'Back to the role' : 'Back to your CVs'}
      </Link>

      <header className="animate-rise mt-6 flex flex-col gap-2">
        <h1 className="text-fluid-2xl font-semibold tracking-tight text-balance">
          {job ? `Your CV, rewritten for ${job.title}` : 'Your tailored CV'}
        </h1>
        {/*
          One sentence, in numbers a person can hold in their head.
          
          The counters and the chips are still below for anyone who wants them,
          but the page used to open with three statistics and a wall of
          coloured labels, and most people only need to know whether anything
          needs them.
        */}
        <p className="text-pretty">
          {report.accepted.length} things from your CV were kept.{' '}
          {report.blocked.length > 0
            ? `${report.blocked.length} the advert asked for were left out, because your CV does not show them. `
            : 'Nothing had to be left out. '}
          {report.borderline.length > 0
            ? `${report.borderline.length} need${report.borderline.length === 1 ? 's' : ''} your decision.`
            : 'Nothing needs your decision.'}
        </p>
        <p className="text-muted-foreground text-sm text-pretty">
          Nothing was added that your CV does not back up. That is checked, not
          promised.
        </p>
      </header>

      {job ? (
        <Card className="border-brand-500/25 bg-brand-500/5 mt-8">
          <CardContent className="pt-6">
            <SubmitApplication
              jobId={job.id}
              jobTitle={job.companyName}
              tailoringId={tailoring.id}
              blocked={report.accepted.length === 0}
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-8">
        <IntegrityReport
          tailoringId={tailoring.id}
          accepted={report.accepted}
          borderline={report.borderline}
          blocked={report.blocked}
          initiallyApproved={tailoring.approvedClaims}
        />
      </div>

      {tailoring.draft.gaps.length > 0 ? (
        <section className="mt-12 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <span className="border-brand-500/25 bg-brand-500/10 grid size-9 place-items-center rounded-lg border">
                <BookOpen className="text-brand-600 dark:text-brand-300 size-4" aria-hidden />
              </span>
              <h2 className="text-fluid-xl font-semibold tracking-tight">
                What you are missing
                <span className="text-muted-foreground ml-2 font-normal tabular-nums">
                  {tailoring.draft.gaps.length}
                </span>
              </h2>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The advert asks for these and your CV does not support them. They
              are not printed on your CV. This part is for you, not the
              employer.
            </p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {tailoring.draft.gaps.map((gap) => (
              <li key={gap.skill}>
                <Card className="card-hover h-full">
                  <CardHeader>
                    <CardTitle className="text-base">{gap.skill}</CardTitle>
                    <CardDescription>{gap.note}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="flex flex-col gap-2.5">
                      {resourcesForGap(gap.skill).map((resource) => (
                        <li key={resource.url}>
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex flex-wrap items-center gap-2 text-sm"
                          >
                            <span className="group-hover:text-brand-600 dark:group-hover:text-brand-300 font-medium underline-offset-4 transition-colors group-hover:underline">
                              {resource.title}
                            </span>
                            <ExternalLink className="text-muted-foreground size-3" aria-hidden />
                            <Badge variant="accepted">{resource.cost}</Badge>
                          </a>
                          <p className="text-muted-foreground text-xs">
                            {resource.provider}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-12 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            <span className="bg-muted grid size-9 place-items-center rounded-lg border">
              <FileText className="size-4" aria-hidden />
            </span>
            <h2 className="text-fluid-xl font-semibold tracking-tight">Preview</h2>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Exactly what would be printed, given your choices above.
            {omissions.length > 0
              ? ` ${omissions.length} thing${omissions.length === 1 ? ' was' : 's were'} left out.`
              : ''}
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-6 pt-6">
            {document.sections.length === 0 ? (
              <p className="text-muted-foreground text-sm leading-relaxed">
                Nothing survived validation. That means the draft rested
                entirely on claims your CV does not support. Try tailoring
                again, or add the missing detail to your CV first.
              </p>
            ) : (
              document.sections.map((section) => (
                <div key={section.heading} className="flex flex-col gap-2">
                  <h3 className="text-muted-foreground border-b pb-1.5 text-xs font-semibold tracking-widest uppercase">
                    {section.heading}
                  </h3>
                  {section.blocks.map((block, index) =>
                    block.kind === 'paragraph' ? (
                      <p key={index} className="text-sm leading-relaxed">
                        {block.text}
                      </p>
                    ) : block.kind === 'entry' ? (
                      /* The job or qualification line — bold here exactly as it
                         renders in the downloaded file, so the preview and the
                         document agree. */
                      <p
                        key={index}
                        className="mt-2 text-sm leading-relaxed font-semibold"
                      >
                        {block.text}
                      </p>
                    ) : (
                      <ul
                        key={index}
                        className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed"
                      >
                        {block.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ),
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

      </section>

      <section className="mt-12">
        <ExportPanel
          tailoringId={tailoring.id}
          defaultTemplate={profile?.default_template ?? 'modern'}
          disabled={document.sections.length === 0}
        />
      </section>
    </Container>
    </main>
  );
}
