'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/lib/dal';
import { jobRepository } from '@/lib/infrastructure/job-repo';

/**
 * The shortlist.
 *
 * One action, and it takes a `FormData` directly rather than going through
 * `useActionState`. That is what lets the save button be a plain form in a
 * Server Component: there is no pending state to render, no error to show, and
 * nothing to hold on the client, so the button ships no JavaScript at all and
 * works with it turned off.
 *
 * Nothing here checks whose shortlist is being changed. The three policies on
 * `saved_jobs` in migration 0005 all key on `auth.uid()`, and the `user_id`
 * column defaults to it, so a request naming somebody else's row is refused by
 * the database. Repeating that check here would be a second copy of the rule.
 */

const toggleSchema = z.object({
  jobId: z.uuid(),
  /** The state the button was rendered in, so the action knows which way to go. */
  saved: z.enum(['true', 'false']),
});

export async function toggleSavedJob(formData: FormData): Promise<void> {
  await requireUser();

  const input = toggleSchema.safeParse({
    jobId: formData.get('jobId'),
    saved: formData.get('saved'),
  });

  /*
   * Returning silently on bad input, which is unusual in this codebase and
   * deliberate here.
   *
   * Every other action returns a message because every other action is driven
   * by a form a person filled in, where a refusal needs explaining. These two
   * fields are hidden inputs the page wrote itself. Malformed values mean a
   * tampered request rather than a mistake somebody made, and the honest
   * response to that is to change nothing and say nothing.
   */
  if (!input.success) return;

  // The form carries the current state, so the new one is its opposite.
  await jobRepository.setSaved(input.data.jobId, input.data.saved !== 'true');

  revalidatePath('/jobs');
  revalidatePath(`/jobs/${input.data.jobId}`);
}
