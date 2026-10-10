'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireUser } from '@/lib/dal';
import { jobRepository } from '@/lib/infrastructure/job-repo';
import { DatabaseError } from '@/lib/infrastructure/supabase-repo';

/**
 * The recruiter's actions, and the one-off choice of which side you are on.
 *
 * Nothing here checks whether the caller is a recruiter. That is not an
 * omission: the `jobs: recruiter posts own` policy in migration 0005 calls
 * `is_recruiter()` and refuses the insert otherwise. Checking here as well
 * would be a second copy of the rule, and two copies of a rule is how they
 * drift apart. What this layer does is turn the refusal into a sentence a
 * person can read.
 */

export interface JobFormState {
  status: 'idle' | 'error';
  message: string;
}

// ---------------------------------------------------------------------------
// Which side are you on
// ---------------------------------------------------------------------------

const roleSchema = z.object({
  role: z.enum(['candidate', 'recruiter'], {
    message: 'Please choose whether you are looking for work or hiring.',
  }),
});

export async function chooseRole(
  _previous: JobFormState,
  formData: FormData,
): Promise<JobFormState> {
  await requireUser();

  const input = roleSchema.safeParse({ role: formData.get('role') });
  if (!input.success) {
    return {
      status: 'error',
      message: input.error.issues[0]?.message ?? 'Please choose one.',
    };
  }

  try {
    await jobRepository.setRole(input.data.role);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return { status: 'error', message: error.message };
    }
    throw error;
  }

  revalidatePath('/', 'layout');
  redirect(input.data.role === 'recruiter' ? '/hiring' : '/jobs');
}

// ---------------------------------------------------------------------------
// Posting a job
// ---------------------------------------------------------------------------

/*
 * The description bounds are the same ones the tailoring path enforces, and
 * for the same reason. A description is what a CV gets compared against, so
 * one too short to compare against is not a job posting yet. The database
 * repeats the check, so a request that bypasses this form still cannot store
 * one.
 */
const postJobSchema = z.object({
  company: z
    .string()
    .trim()
    .min(2, 'Please give the company a name.')
    .max(120, 'That company name is too long.'),
  title: z
    .string()
    .trim()
    .min(3, 'Please give the role a title.')
    .max(120, 'That title is too long.'),
  location: z
    .string()
    .trim()
    .min(2, 'Please say where the role is based.')
    .max(120, 'That location is too long.'),
  description: z
    .string()
    .trim()
    .min(80, 'Please describe the role properly. That is too short to tailor against.')
    .max(15_000, 'That description is very long. Please trim it.'),
  requirements: z
    .string()
    .trim()
    .min(10, 'Please list what the role requires.')
    .max(5_000, 'That requirements list is very long.'),
  packageMin: z.coerce.number().int().nonnegative().optional(),
  packageMax: z.coerce.number().int().nonnegative().optional(),
});

export async function postJob(
  _previous: JobFormState,
  formData: FormData,
): Promise<JobFormState> {
  const user = await requireUser();

  const input = postJobSchema.safeParse({
    company: formData.get('company'),
    title: formData.get('title'),
    location: formData.get('location'),
    description: formData.get('description'),
    requirements: formData.get('requirements'),
    packageMin: formData.get('packageMin') || undefined,
    packageMax: formData.get('packageMax') || undefined,
  });

  if (!input.success) {
    return {
      status: 'error',
      message: input.error.issues[0]?.message ?? 'That posting was not valid.',
    };
  }

  const { packageMin, packageMax } = input.data;
  if (packageMin !== undefined && packageMax !== undefined && packageMin > packageMax) {
    return {
      status: 'error',
      message: 'The bottom of the range cannot be above the top of it.',
    };
  }

  let jobId: string;

  try {
    const companyId = await jobRepository.findOrCreateCompany(input.data.company);

    jobId = await jobRepository.createJob({
      companyId,
      title: input.data.title,
      location: input.data.location,
      description: input.data.description,
      requirements: input.data.requirements,
      packageMin: packageMin ?? null,
      packageMax: packageMax ?? null,
    });
  } catch (error) {
    if (error instanceof DatabaseError) {
      // The most likely cause is the role check in the database refusing a
      // candidate account. Say that rather than "something went wrong".
      return {
        status: 'error',
        message:
          'That job could not be posted. Posting jobs is only available on a recruiter account.',
      };
    }
    console.error('[jobs] post failed', { userId: user.id, error });
    return {
      status: 'error',
      message: 'Something went wrong posting that job. Please try again.',
    };
  }

  revalidatePath('/hiring');
  revalidatePath('/jobs');
  redirect(`/hiring/${jobId}`);
}

// ---------------------------------------------------------------------------
// Moving an application along
// ---------------------------------------------------------------------------

const statusSchema = z.object({
  applicationId: z.uuid(),
  jobId: z.uuid(),
  status: z.enum(['submitted', 'reviewing', 'shortlisted', 'rejected', 'hired']),
});

export async function setApplicationStatus(
  _previous: JobFormState,
  formData: FormData,
): Promise<JobFormState> {
  await requireUser();

  const input = statusSchema.safeParse({
    applicationId: formData.get('applicationId'),
    jobId: formData.get('jobId'),
    status: formData.get('status'),
  });

  if (!input.success) {
    return { status: 'error', message: 'That change was not valid.' };
  }

  try {
    await jobRepository.setApplicationStatus(
      input.data.applicationId,
      input.data.status,
    );
  } catch (error) {
    if (error instanceof DatabaseError) {
      return { status: 'error', message: error.message };
    }
    throw error;
  }

  revalidatePath(`/hiring/${input.data.jobId}`);
  return { status: 'idle', message: '' };
}
