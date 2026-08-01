import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireConsentedUser } from '@/lib/dal';
import {
  assembleResumeDocument,
  findTemplate,
  validateAtsDocument,
} from '@/lib/domain/resume-document';
import { renderDocx } from '@/lib/infrastructure/export/docx-renderer';
import { renderPdf } from '@/lib/infrastructure/export/pdf-renderer';
import { resumeRepository } from '@/lib/infrastructure/supabase-repo';
import { createClient } from '@/lib/infrastructure/supabase/server';
import type { IntegrityReport } from '@/lib/domain/types';

/**
 * File download.
 *
 * The important property of this route is what it does **not** accept. It takes
 * a tailoring id, a format and a template id, and nothing else. The document is
 * rebuilt here, from the stored integrity report and the stored approvals, by
 * the same `assembleResumeDocument` that produced the on-screen preview.
 *
 * That is deliberate and it is the whole defence. If this route accepted a
 * document, or a list of skills, or an "include" array, a crafted request could
 * put a blocked claim into a file. It does not, so it cannot: the only path
 * from a draft to bytes runs through the validator's output.
 *
 * A blocked claim is therefore unreachable from here even for a caller who
 * controls every parameter.
 */

const querySchema = z.object({
  format: z.enum(['pdf', 'docx']),
  template: z.string().max(40).optional(),
});

export async function GET(
  request: Request,
  // Next 15 makes route params async. This must be awaited.
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await requireConsentedUser();

  const query = querySchema.safeParse({
    format: new URL(request.url).searchParams.get('format') ?? 'pdf',
    template: new URL(request.url).searchParams.get('template') ?? undefined,
  });

  if (!query.success) {
    return NextResponse.json({ error: 'Unsupported format.' }, { status: 400 });
  }

  try {
    // RLS scopes this. Someone else's tailoring is indistinguishable from one
    // that does not exist.
    const tailoring = await resumeRepository.getTailoring(id);
    if (!tailoring) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }

    // Decrypted here and nowhere else in the request path. This is the single
    // point at which the withheld identity rejoins the document.
    const identity = await resumeRepository.getIdentity(tailoring.resumeId);
    if (!identity) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }

    const template = findTemplate(query.data.template ?? 'modern');

    const { document } = assembleResumeDocument({
      identity,
      draft: tailoring.draft,
      report: tailoring.report as IntegrityReport,
      approved: new Set(tailoring.approvedClaims),
    });

    if (document.sections.length === 0) {
      return NextResponse.json(
        {
          error:
            'There is nothing to export. Every claim in this draft was refused, so there is no honest version to download.',
        },
        { status: 409 },
      );
    }

    // Belt and braces. The type system already rules out tables and images;
    // this catches control characters and unrecognised headings before they
    // reach a file a recruiter will open.
    const problems = validateAtsDocument(document);
    if (problems.length > 0) {
      console.error('[export] ATS validation failed', { id, problems });
      return NextResponse.json(
        { error: 'That document could not be exported. Please try again.' },
        { status: 500 },
      );
    }

    const bytes =
      query.data.format === 'pdf'
        ? await renderPdf(document, template)
        : await renderDocx(document, template);

    const supabase = await createClient();
    await supabase.rpc('log_audit_event', {
      p_action: 'resume.exported',
      p_metadata: {
        tailoring_id: id,
        format: query.data.format,
        template: template.id,
      },
    });
    await supabase
      .from('tailored_resumes')
      .update({ status: 'exported' })
      .eq('id', id);

    const surname = (identity.fullName ?? 'CV')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const filename = `${surname || 'CV'}-CV.${query.data.format}`;

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type':
          query.data.format === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        // `attachment` rather than `inline`: a downloaded file cannot be
        // rendered in the page, which closes off content-sniffing tricks.
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'no-store, private',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[export] failed', { userId: user.id, id, error });
    return NextResponse.json(
      { error: 'That document could not be exported. Please try again.' },
      { status: 500 },
    );
  }
}
