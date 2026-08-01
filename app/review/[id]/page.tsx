import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookOpen, ShieldCheck } from 'lucide-react';

import { IntegrityReport } from '@/components/integrity-report';
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
import type { IntegrityReport as Report } from '@/lib/domain/types';

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireConsentedUser();

  const tailoring = await resumeRepository.getTailoring(id);
  if (!tailoring) notFound();

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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          Back to your CVs
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          What Candid did, and what it refused
        </h1>
        <p className="text-muted-foreground text-sm">
          Every claim in the draft was checked against your original CV.
        </p>
      </header>

      <Card>
        <CardContent className="flex items-start gap-3 pt-6">
          <ShieldCheck className="text-accepted mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-sm">
            Your name, email address and phone number were never sent. The model
            saw only your experience, skills and education.
          </p>
        </CardContent>
      </Card>

      <IntegrityReport
        tailoringId={tailoring.id}
        accepted={report.accepted}
        borderline={report.borderline}
        blocked={report.blocked}
        initiallyApproved={tailoring.approvedClaims}
      />

      {tailoring.draft.gaps.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-lg font-medium">
            <BookOpen className="size-4" aria-hidden />
            What you are missing ({tailoring.draft.gaps.length})
          </h2>
          <p className="text-muted-foreground text-sm">
            The advert asks for these and your CV does not support them. They
            are not printed on your CV — this is for you, not the employer.
          </p>

          <ul className="flex flex-col gap-3">
            {tailoring.draft.gaps.map((gap) => (
              <li key={gap.skill}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{gap.skill}</CardTitle>
                    <CardDescription>{gap.note}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="flex flex-col gap-2">
                      {resourcesForGap(gap.skill).map((resource) => (
                        <li
                          key={resource.url}
                          className="flex flex-wrap items-center gap-2 text-sm"
                        >
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline underline-offset-4"
                          >
                            {resource.title}
                          </a>
                          <span className="text-muted-foreground text-xs">
                            {resource.provider}
                          </span>
                          <span className="border-accepted/40 text-accepted rounded-full border px-2 py-0.5 text-xs">
                            {resource.cost}
                          </span>
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

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Preview</h2>
        <p className="text-muted-foreground text-sm">
          Exactly what would be printed, given your choices above.
          {omissions.length > 0
            ? ` ${omissions.length} thing${omissions.length === 1 ? ' was' : 's were'} left out.`
            : ''}
        </p>
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            {document.sections.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nothing survived validation. That means the draft rested
                entirely on claims your CV does not support — try tailoring
                again, or add the missing detail to your CV first.
              </p>
            ) : (
              document.sections.map((section) => (
                <div key={section.heading} className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold tracking-wide uppercase">
                    {section.heading}
                  </h3>
                  {section.blocks.map((block, index) =>
                    block.kind === 'paragraph' ? (
                      <p key={index} className="text-sm">
                        {block.text}
                      </p>
                    ) : (
                      <ul
                        key={index}
                        className="flex list-disc flex-col gap-1 pl-5 text-sm"
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
        <p className="text-muted-foreground text-xs">
          Downloading as PDF and Word arrives in the next phase.
        </p>
      </section>
    </main>
  );
}
