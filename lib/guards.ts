import 'server-only';

import { redirect } from 'next/navigation';

import { requireUser, type VerifiedUser } from '@/lib/dal';
import { jobRepository, type UserRole } from '@/lib/infrastructure/job-repo';

/**
 * Which side of the hire you are on, and what that stops you reaching.
 *
 * The rule this file exists to enforce is simple to say and was not being
 * said anywhere: a job seeker and an employer are not looking at the same
 * product. One has a CV, applies, and tracks what came back. The other writes
 * adverts and reads the people who answered them. Neither has any use for the
 * other's screens, and offering them is not generosity, it is a bug.
 *
 * Before this, every signed-in account could reach every page. The database
 * refused most of what the wrong side could then try, which is why nothing
 * leaked, but refusing at the end of a filled-in form is the wrong place to
 * refuse. A job seeker could write a whole advert and press post before being
 * told. The option should not have been there.
 *
 * So the gate is here, in front of the page, and the policies in migration
 * 0009 sit behind it for a request that never went through a page at all.
 *
 * A note on redirect loops, because this is where one would come from. Every
 * destination below is a page that accepts the role it is sent. A job seeker
 * sent to /jobs is allowed on /jobs; an employer sent to /hiring is allowed on
 * /hiring; an account with no role is sent to /onboarding, which redirects
 * nobody. No pair of pages here can point at each other.
 */

/** Where each side is at home. The only redirect targets this file uses. */
const HOME: Record<UserRole, string> = {
  candidate: '/jobs',
  recruiter: '/hiring',
};

/**
 * A signed-in account that has answered the question, whichever way.
 *
 * Use this on the few pages that serve both sides but need to know which one
 * is reading, such as a job advert: the employer who wrote it may read it
 * back, and nobody else's employer may.
 */
export async function requireChosenSide(): Promise<{
  user: VerifiedUser;
  role: UserRole;
}> {
  const user = await requireUser();
  const role = await jobRepository.getRole();

  // Never answered, so there is nothing to enforce yet. Ask first.
  if (role === null) redirect('/onboarding');

  return { user, role };
}

/**
 * One side only. The wrong side is sent home rather than refused.
 *
 * A redirect, not a 404, because there is nothing secret about the existence
 * of the other half of the product: it is on the landing page. What is wrong
 * is being stood in front of it. A 404 here would also be a lie, and the
 * pages that genuinely must not confirm a row exists still call `notFound`
 * themselves, after this.
 */
export async function requireSide(expected: UserRole): Promise<VerifiedUser> {
  const { user, role } = await requireChosenSide();
  if (role !== expected) redirect(HOME[role]);
  return user;
}
