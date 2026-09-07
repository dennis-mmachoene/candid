'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireConsentedUser } from '@/lib/dal';
import { resumeRepository } from '@/lib/infrastructure/supabase-repo';

/**
 * Removing one stored CV.
 *
 * Until now the only way to get rid of a bad upload was to delete the whole
 * account. That is not a reasonable thing to ask of somebody whose parser
 * output looked wrong once, and a person who cannot undo a mistake stops
 * trying things.
 */

const idSchema = z.object({ id: z.uuid() });

export interface DeleteResumeState {
  status: 'idle' | 'error';
  message: string;
}

export async function deleteResume(
  _previous: DeleteResumeState,
  formData: FormData,
): Promise<DeleteResumeState> {
  // The gate, next to the data. Row-Level Security is underneath it as well,
  // so an id belonging to somebody else matches no rows rather than being
  // refused — which tells the caller nothing about whether it exists.
  await requireConsentedUser();

  const input = idSchema.safeParse({ id: formData.get('id') });
  if (!input.success) {
    return { status: 'error', message: 'That CV could not be found.' };
  }

  try {
    await resumeRepository.deleteResume(input.data.id);
  } catch (cause) {
    // Shape only. The value is derived from the user's own data.
    console.error('[resumes] delete failed', {
      name: cause instanceof Error ? cause.name : typeof cause,
    });
    return {
      status: 'error',
      message: 'That could not be deleted right now. Please try again.',
    };
  }

  revalidatePath('/dashboard');
  revalidatePath('/history');
  return { status: 'idle', message: '' };
}
