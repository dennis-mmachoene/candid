'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireConsentedUser } from '@/lib/dal';
import { tailorCv } from '@/lib/domain/tailoring';
import { AIProviderError, claudeProvider } from '@/lib/infrastructure/claude-provider';
import { describeWindow, rateLimiter } from '@/lib/infrastructure/rate-limit';
import { DatabaseError, resumeRepository } from '@/lib/infrastructure/supabase-repo';
import { createClient } from '@/lib/infrastructure/supabase/server';

/**
 * Tailor a stored CV against a pasted advert.
 *
 * The rate limit is checked first, before anything that costs money. It fails
 * closed: if the limiter errors, the request is denied. A limiter that stops
 * working when the database is struggling is a limiter that is absent exactly
 * when it is needed.
 *
 * The advert is stored before the model call, so a failed tailoring can be
 * retried without the user retyping it.
 */

export interface TailorState {
  status: 'idle' | 'error';
  message: string;
}

const tailorSchema = z.object({
  resumeId: z.uuid('That CV could not be found.'),
  advert: z
    .string()
    .trim()
    .min(80, 'Please paste the full job advert — that looks too short to work from.')
    .max(15_000, 'That advert is very long. Please paste just the role description.'),
  title: z.string().trim().max(200).optional(),
});

export async function tailorResume(
  _previous: TailorState,
  formData: FormData,
): Promise<TailorState> {
  const user = await requireConsentedUser();

  const input = tailorSchema.safeParse({
    resumeId: formData.get('resumeId'),
    advert: formData.get('advert'),
    title: formData.get('title') || undefined,
  });

  if (!input.success) {
    return {
      status: 'error',
      message: input.error.issues[0]?.message ?? 'That request was not valid.',
    };
  }

  // Before the paid call, not after.
  const allowed = await rateLimiter.consume('tailor');
  if (!allowed) {
    return {
      status: 'error',
      message: `You have reached the tailoring limit for ${describeWindow('tailor')}. Please try again later.`,
    };
  }

  let tailoringId: string;

  try {
    // RLS scopes this. A resume id belonging to someone else returns null.
    const resume = await resumeRepository.getResume(input.data.resumeId);
    if (!resume) {
      return { status: 'error', message: 'That CV could not be found.' };
    }

    const supabase = await createClient();
    const { data: advertRow, error: advertError } = await supabase
      .from('job_descriptions')
      .insert({ content: input.data.advert, title: input.data.title ?? null })
      .select('id')
      .single();

    if (advertError || !advertRow) {
      console.error('[tailor] advert insert failed', advertError);
      return {
        status: 'error',
        message: 'Something went wrong saving that advert. Please try again.',
      };
    }

    // `tailorCv` de-identifies before it calls the provider. The stored content
    // is already de-identified, so this is a second pass over clean text —
    // deliberately. `deidentify()` is idempotent, and running it again means
    // that even if something identifying were ever written to the database by a
    // future bug, it still would not reach the model.
    const outcome = await tailorCv({
      rawCvText: resume.content,
      jobAdvert: input.data.advert,
      provider: claudeProvider,
    });

    const tailoring = await resumeRepository.saveTailoring({
      resumeId: resume.id,
      jobDescriptionId: advertRow.id,
      draft: outcome.draft,
      report: outcome.report,
    });

    tailoringId = tailoring.id;

    // Keeps this CV out of the retention purge for another twelve months.
    await resumeRepository.touchResume(resume.id);

    await supabase.rpc('log_audit_event', {
      p_action: 'resume.tailored',
      p_metadata: {
        tailoring_id: tailoring.id,
        accepted: outcome.report.accepted.length,
        borderline: outcome.report.borderline.length,
        blocked: outcome.report.blocked.length,
      },
    });
  } catch (error) {
    if (error instanceof AIProviderError || error instanceof DatabaseError) {
      return { status: 'error', message: error.message };
    }
    console.error('[tailor] unexpected failure', { userId: user.id, error });
    return {
      status: 'error',
      message: 'Something went wrong tailoring that CV. Please try again.',
    };
  }

  // Outside the try: redirect() works by throwing, so catching it here would
  // swallow the navigation and report a failure that did not happen.
  revalidatePath('/dashboard');
  redirect(`/review/${tailoringId}`);
}

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------

const approveSchema = z.object({
  tailoringId: z.uuid(),
  approved: z.array(z.string().max(120)).max(50),
});

/**
 * Record which borderline claims the user approved.
 *
 * Note what this does **not** do: it does not decide what goes in the document.
 * The approved list is stored as-is, and the document assembler consults it only
 * for claims the validator already marked borderline. Putting a blocked claim in
 * here changes nothing, which is why no filtering is needed at this layer and
 * why adding some would be misleading about where the guarantee lives.
 */
export async function approveClaims(
  tailoringId: string,
  approved: readonly string[],
): Promise<{ ok: boolean; message?: string }> {
  await requireConsentedUser();

  const input = approveSchema.safeParse({ tailoringId, approved });
  if (!input.success) {
    return { ok: false, message: 'That selection was not valid.' };
  }

  try {
    await resumeRepository.setApprovedClaims(
      input.data.tailoringId,
      input.data.approved,
    );
  } catch (error) {
    if (error instanceof DatabaseError) {
      return { ok: false, message: error.message };
    }
    console.error('[approve] unexpected failure', error);
    return { ok: false, message: 'Something went wrong saving your choices.' };
  }

  revalidatePath(`/review/${tailoringId}`);
  return { ok: true };
}
