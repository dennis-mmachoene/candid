'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { requireUser, reverifyForDestructiveAction } from '@/lib/dal';
import { TEMPLATES } from '@/lib/domain/resume-document';
import { deleteAuthUser } from '@/lib/infrastructure/supabase/admin';
import { resumeRepository } from '@/lib/infrastructure/supabase-repo';
import { createClient } from '@/lib/infrastructure/supabase/server';

const templateSchema = z.object({
  template: z.enum(
    TEMPLATES.map((t) => t.id) as [string, ...string[]],
  ),
});

export interface SettingsState {
  status: 'idle' | 'saved' | 'error';
  message: string;
}

export async function saveDefaultTemplate(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();

  const input = templateSchema.safeParse({ template: formData.get('template') });
  if (!input.success) {
    return { status: 'error', message: 'That template does not exist.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ default_template: input.data.template })
    .eq('id', user.id);

  if (error) {
    console.error('[settings] template update failed', error);
    return {
      status: 'error',
      message: 'That could not be saved. Please try again.',
    };
  }

  revalidatePath('/settings');
  return { status: 'saved', message: 'Saved.' };
}

// ---------------------------------------------------------------------------
// Erasure — POPIA §24
// ---------------------------------------------------------------------------

const deleteSchema = z.object({
  // Typing the word is not security; it is friction, and friction is the
  // correct response to an irreversible action. The real protection is the
  // session re-verification below.
  confirmation: z.literal('DELETE', {
    message: 'Please type DELETE exactly to confirm.',
  }),
});

export interface DeleteState {
  status: 'idle' | 'error';
  message: string;
}

/**
 * Delete everything the user owns, then delete the user.
 *
 * Order matters and is deliberately belt and braces. Every table cascades from
 * `auth.users`, so deleting the auth user alone would be enough. The
 * application-level delete runs first anyway, so that if the privileged auth
 * call is the thing that fails, the user's CVs are already gone rather than
 * orphaned behind a half-finished deletion.
 *
 * Nothing needs erasing at the AI provider. No identifying data was ever sent
 * there, which is the point of the whole architecture.
 */
export async function deleteAccount(
  _previous: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  const input = deleteSchema.safeParse({
    confirmation: formData.get('confirmation'),
  });

  if (!input.success) {
    return {
      status: 'error',
      message: input.error.issues[0]?.message ?? 'Please confirm to continue.',
    };
  }

  // A round trip to the Auth server rather than a locally validated token. The
  // session may have been revoked since this page rendered, and account
  // deletion is not something to run on a stale assumption.
  const user = await reverifyForDestructiveAction();

  try {
    await resumeRepository.deleteEverything();
  } catch (error) {
    console.error('[delete] row deletion failed', { userId: user.id, error });
    return {
      status: 'error',
      message: 'Your data could not be deleted. Nothing was removed. Please try again.',
    };
  }

  try {
    // The only privileged call in the application, and the only place the
    // secret key is used. A user's own session cannot delete their auth record.
    await deleteAuthUser(user.id);
  } catch {
    return {
      status: 'error',
      message:
        'Your CVs were deleted but your account could not be closed. Please try again, or contact support.',
    };
  }

  const supabase = await createClient();
  await supabase.auth.signOut();

  redirect('/goodbye');
}
