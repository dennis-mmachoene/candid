import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen, ExternalLink, EyeOff, FileText } from 'lucide-react';

import { ExportPanel } from '@/components/export-panel';
import { IntegrityReport } from '@/components/integrity-report';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireConsentedUser } from '@/lib/dal';
import { resourcesForGap } from '@/lib/domain/learning';
import { assembleResumeDocument } from '@/lib/domain/resume-document';
import { resumeRepository } from '@/lib/infrastructure/supabase-repo';
import { createClient } from '@/lib/infrastructure/supabase/server';
import type { IntegrityReport as Report } from '@/lib/domain/types';

export const metadata = { title: 'Review' };

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireConsentedUser();

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
  const { document, omissions } = assembleResumeDocument({
    identity: { fullName: null, email: null, phone: null, otherLines: [] },
    draft: tailoring.draft,
    report,
    approved,
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/dashboard"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to your CVs
      </Link>

      <header className="animate-rise mt-6 flex flex-col gap-2">
        <Badge variant="brand">Step 3 of 3</Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {user.firstName}, here is what Candid kept and what it refused
        </h1>
        <p className="text-muted-foreground text-pretty">
          Every claim in the draft was checked against your original CV.
        </p>
      </header>

      <Card className="border-brand-500/25 bg-brand-500/5 mt-8">
        <CardContent className="flex items-start gap-3 pt-6">
          <span className="border-brand-500/25 bg-brand-500/10 grid size-9 shrink-0 place-items-center rounded-lg border">
            <EyeOff className="text-brand-600 dark:text-brand-300 size-4" aria-hidden />
          </span>
          <p className="text-sm leading-relaxed">
            Your name, email address and phone number were never sent. The model
            saw only your experience, skills and education.
          </p>
        </CardContent>
      </Card>

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
              <h2 className="text-xl font-semibold tracking-tight">
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
            <h2 className="text-xl font-semibold tracking-tight">Preview</h2>
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
    </main>
  );
}
