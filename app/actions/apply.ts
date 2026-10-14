'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireSide } from '@/lib/guards';
import { tailorCv } from '@/lib/domain/tailoring';
import { AIProviderError, claudeProvider } from '@/lib/infrastructure/claude-provider';
import { jobRepository } from '@/lib/infrastructure/job-repo';
import { describeWindow, rateLimiter } from '@/lib/infrastructure/rate-limit';
import { DatabaseError, resumeRepository } from '@/lib/infrastructure/supabase-repo';
import { createClient } from '@/lib/infrastructure/supabase/server';

/**
 * Applying to a job, the two ways it can be done.
 *
 * This is the decision the whole product exists around, so it is worth being
 * clear about what each path does.
 *
 * **As your profile.** The CV you uploaded goes to the recruiter unchanged. No
 * model is called, nothing is rewritten, and nothing needs checking because
 * nothing was generated.
 *
 * **Tailored.** The model rewrites your experience in the advert's language,
 * every claim it makes is checked against your own CV, and anything it cannot
 * trace is blocked. You read the report, decide on anything borderline, and
 * then submit. The application is only created at that last step, so closing
 * the tab halfway through leaves no half-considered application behind.
 *
 * The advert the model sees is the job's own description and requirements,
 * read out of the database. The candidate does not type it, which removes a
 * whole class of "I pasted the wrong advert" mistake and means the tailoring
 * is against exactly what the recruiter wrote.
 */

export interface ApplyState {
  status: 'idle' | 'error';
  message: string;
}

const jobIdSchema = z.object({ jobId: z.uuid('That job could not be found.') });

// ---------------------------------------------------------------------------
// Apply as you are
// ---------------------------------------------------------------------------

export async function applyWithProfile(
  _previous: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  const user = await requireSide('candidate');

  const input = jobIdSchema.safeParse({ jobId: formData.get('jobId') });
  if (!input.success) {
    return { status: 'error', message: 'That job could not be found.' };
  }

  try {
    const resumes = await resumeRepository.listResumes();
    const resume = resumes[0];
    if (!resume) {
      return {
        status: 'error',
        message: 'Upload a CV first. That becomes your profile.',
      };
    }

    const job = await jobRepository.getJob(input.data.jobId);
    if (!job || !job.isOpen) {
      return { status: 'error', message: 'That job is no longer open.' };
    }

    await jobRepository.apply({
      jobId: job.id,
      mode: 'profile',
      resumeId: resume.id,
    });

    const supabase = await createClient();
    await supabase.rpc('log_audit_event', {
      p_action: 'application.submitted',
      p_metadata: { job_id: job.id, mode: 'profile' },
    });
  } catch (error) {
    if (error instanceof DatabaseError) {
      return { status: 'error', message: error.message };
    }
    console.error('[apply] unexpected failure', { userId: user.id, error });
    return {
      status: 'error',
      message: 'Something went wrong sending that application. Please try again.',
    };
  }

  revalidatePath('/applications');
  redirect('/applications?applied=1');
}

// ---------------------------------------------------------------------------
// Tailor first
// ---------------------------------------------------------------------------

export async function tailorForJob(
  _previous: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  const user = await requireSide('candidate');

  const input = jobIdSchema.safeParse({ jobId: formData.get('jobId') });
  if (!input.success) {
    return { status: 'error', message: 'That job could not be found.' };
  }

  // Before the paid call, not after. A limiter checked afterwards lets a burst
  // of concurrent requests each pass before any of them records a unit.
  const allowed = await rateLimiter.consume('tailor');
  if (!allowed) {
    return {
      status: 'error',
      message: `You have reached the tailoring limit for ${describeWindow('tailor')}. Please try again later.`,
    };
  }

  let tailoringId: string;
  let jobId: string;

  try {
    const resumes = await resumeRepository.listResumes();
    const resume = resumes[0];
    if (!resume) {
      return {
        status: 'error',
        message: 'Upload a CV first. That becomes your profile.',
      };
    }

    const job = await jobRepository.getJob(input.data.jobId);
    if (!job || !job.isOpen) {
      return { status: 'error', message: 'That job is no longer open.' };
    }
    jobId = job.id;

    // The advert is the recruiter's own words, joined the way a person reads
    // them. Stored before the model call, so a failure can be retried without
    // losing it.
    const advert = `${job.title}\n${job.companyName} — ${job.location}\n\n${job.description}\n\nRequirements\n${job.requirements}`;

    const supabase = await createClient();
    const { data: advertRow, error: advertError } = await supabase
      .from('job_descriptions')
      .insert({ content: advert, title: job.title })
      .select('id')
      .single();

    if (advertError || !advertRow) {
      console.error('[apply] advert insert failed', advertError);
      return {
        status: 'error',
        message: 'Something went wrong starting that tailoring. Please try again.',
      };
    }

    const outcome = await tailorCv({
      cvText: resume.content,
      jobAdvert: advert,
      provider: claudeProvider,
    });

    const tailoring = await resumeRepository.saveTailoring({
      resumeId: resume.id,
      jobDescriptionId: advertRow.id,
      draft: outcome.draft,
      report: outcome.report,
    });

    tailoringId = tailoring.id;

    await resumeRepository.touchResume(resume.id);

    await supabase.rpc('log_audit_event', {
      p_action: 'resume.tailored',
      p_metadata: {
        tailoring_id: tailoring.id,
        job_id: job.id,
        accepted: outcome.report.accepted.length,
        borderline: outcome.report.borderline.length,
        blocked: outcome.report.blocked.length,
      },
    });
  } catch (error) {
    if (error instanceof AIProviderError || error instanceof DatabaseError) {
      return { status: 'error', message: error.message };
    }
    console.error('[apply] tailoring failed', { userId: user.id, error });
    return {
      status: 'error',
      message: 'Something went wrong tailoring your CV. Please try again.',
    };
  }

  // The application is not created yet. The candidate reads the report first.
  redirect(`/review/${tailoringId}?job=${jobId}`);
}

// ---------------------------------------------------------------------------
// Send the tailored version
// ---------------------------------------------------------------------------

const submitSchema = z.object({
  jobId: z.uuid('That job could not be found.'),
  tailoringId: z.uuid('That tailored CV could not be found.'),
});

export async function submitTailoredApplication(
  _previous: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  const user = await requireSide('candidate');

  const input = submitSchema.safeParse({
    jobId: formData.get('jobId'),
    tailoringId: formData.get('tailoringId'),
  });
  if (!input.success) {
    return {
      status: 'error',
      message: input.error.issues[0]?.message ?? 'That request was not valid.',
    };
  }

  try {
    // RLS scopes both. Someone else's tailoring is indistinguishable from one
    // that does not exist.
    const tailoring = await resumeRepository.getTailoring(input.data.tailoringId);
    if (!tailoring) {
      return { status: 'error', message: 'That tailored CV could not be found.' };
    }

    const job = await jobRepository.getJob(input.data.jobId);
    if (!job || !job.isOpen) {
      return { status: 'error', message: 'That job is no longer open.' };
    }

    /*
     * The one rule this action enforces that the database cannot.
     *
     * A tailoring in which nothing survived validation has no honest version
     * to send. The export route already refuses to produce a file from it, and
     * this refuses to attach it to an application, so the two agree.
     */
    if (tailoring.report.accepted.length === 0) {
      return {
        status: 'error',
        message:
          'Nothing in that tailored CV could be traced back to your own. There is no honest version to send.',
      };
    }

    await jobRepository.apply({
      jobId: job.id,
      mode: 'tailored',
      tailoredResumeId: tailoring.id,
    });

    const supabase = await createClient();
    await supabase.rpc('log_audit_event', {
      p_action: 'application.submitted',
      p_metadata: {
        job_id: job.id,
        mode: 'tailored',
        tailoring_id: tailoring.id,
      },
    });
  } catch (error) {
    if (error instanceof DatabaseError) {
      return { status: 'error', message: error.message };
    }
    console.error('[apply] submit failed', { userId: user.id, error });
    return {
      status: 'error',
      message: 'Something went wrong sending that application. Please try again.',
    };
  }

  revalidatePath('/applications');
  redirect('/applications?applied=1');
}
