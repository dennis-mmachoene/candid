'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/lib/dal';
import {
  DatabaseError,
  resumeRepository,
} from '@/lib/infrastructure/supabase-repo';

/**
 * The profile: what gets printed at the top of every CV Candid produces.
 *
 * Until this existed, the only way those fields were ever filled in was the
 * parser reading the top of an uploaded document. That works most of the time
 * and the rest of the time it is unfixable, which is the worse half of a
 * feature. A name read out of a two-column layout, a headline that is really
 * the second line of a street address, a phone number with a digit missing:
 * all of it went straight onto the exported CV with no way to correct it.
 */

export interface ProfileFormState {
  status: 'idle' | 'saved' | 'error';
  message: string;
}

/** Empty means empty. A blank field is an instruction to clear the column. */
const blankable = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .transform((value) => (value === '' ? null : value));

const profileSchema = z.object({
  // The only required field. A CV with no name on it is not a CV, and this is
  // the one value the document cannot be assembled without.
  fullName: z
    .string()
    .trim()
    .min(1, 'Your CV needs a name on it.')
    .max(120, 'That name is too long.'),
  headline: blankable(160, 'That headline is too long. One line is the point of it.'),
  phone: blankable(40, 'That phone number is too long.'),
  location: blankable(120, 'That location is too long.'),
  links: z.string().max(2_000, 'That is more links than a CV should carry.'),
});

/** How many links a CV can carry before it stops being a CV. */
const MAX_LINKS = 8;

export async function saveProfile(
  _previous: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser();

  const input = profileSchema.safeParse({
    fullName: formData.get('fullName'),
    headline: formData.get('headline'),
    phone: formData.get('phone'),
    location: formData.get('location'),
    links: formData.get('links') ?? '',
  });

  if (!input.success) {
    return {
      status: 'error',
      message: input.error.issues[0]?.message ?? 'That profile was not valid.',
    };
  }

  /*
   * One link per line, in the order given.
   *
   * A Set rather than a plain filter, because the parser can pull the same
   * URL out of a CV twice when it appears in both a header and a footer, and
   * two identical lines on a printed CV look like a mistake by the applicant.
   */
  const links = Array.from(
    new Set(
      input.data.links
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
    ),
  ).slice(0, MAX_LINKS);

  try {
    await resumeRepository.replaceProfileHeader({
      fullName: input.data.fullName,
      headline: input.data.headline,
      // Never written. It belongs to the account, and the repository ignores
      // it; passing null here says so rather than passing a value that would
      // be silently dropped.
      email: null,
      phone: input.data.phone,
      location: input.data.location,
      links,
    });
  } catch (error) {
    if (error instanceof DatabaseError) {
      return { status: 'error', message: error.message };
    }
    console.error('[profile] save failed', { userId: user.id, error });
    return {
      status: 'error',
      message: 'Something went wrong saving that. Please try again.',
    };
  }

  // Every route in this application is server-rendered on demand, so there is
  // no cached page to invalidate. This is here for the day one of them is
  // cached and nobody remembers that the name on it came from here.
  revalidatePath('/profile');
  revalidatePath('/dashboard');

  return {
    status: 'saved',
    message: 'Saved. This is what prints at the top of your CV.',
  };
}
