import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';

import { createClient } from './infrastructure/supabase/server';
import { POLICY_VERSION } from './domain/consent';

/**
 * The Data Access Layer.
 *
 * Every authoritative check about who the caller is happens here, close to the
 * data. Nothing in this file trusts anything the client sent: not a user id in
 * a form field, not a header, not a cookie taken at face value.
 *
 * Why here and not in middleware: middleware runs before routing and is easy to
 * bypass or misconfigure, and a single missed matcher pattern silently opens a
 * route. Putting the check next to the query means a route that forgets to call
 * `requireUser()` still cannot read another user's rows, because Row-Level
 * Security is underneath it. Two independent things have to fail. This is also
 * what Next.js's own auth guidance recommends.
 *
 * `getClaims()` rather than `getSession()`: it verifies the JWT signature
 * against the project's published keys. `getSession()` reads a cookie without
 * revalidating it, and cookies are attacker-controlled.
 *
 * `cache()` dedupes within a single render pass, so a page that calls
 * `requireUser()` in three components does one verification, not three.
 */

export interface VerifiedUser {
  id: string;
  email: string;
  /** Google's display name, when it gave us one. */
  fullName: string | null;
  /** First name only, for greetings. Falls back to the email local part. */
  firstName: string;
}

/**
 * Pull a usable first name out of Google's identity claims.
 *
 * Two things this deliberately does not do:
 *
 *   - It does not read the name off the user's CV. That name belongs to the
 *     document, and the profile page is where it is edited. A greeting that
 *     silently preferred the CV would change every time a new CV was uploaded.
 *   - It does not store the name. It is read from the session each request, so
 *     there is no extra copy of a person's name sitting in a table.
 *
 * If Google gives us nothing usable we fall back to the email local part
 * rather than inventing a greeting or leaving an awkward blank.
 */
function deriveNames(claims: Record<string, unknown>): {
  fullName: string | null;
  firstName: string;
} {
  const metadata =
    typeof claims.user_metadata === 'object' && claims.user_metadata !== null
      ? (claims.user_metadata as Record<string, unknown>)
      : {};

  const candidates = [
    metadata.given_name,
    metadata.full_name,
    metadata.name,
  ].filter((value): value is string => typeof value === 'string' && value.trim() !== '');

  const fullNameCandidate = [metadata.full_name, metadata.name].find(
    (value): value is string => typeof value === 'string' && value.trim() !== '',
  );
  const fullName = fullNameCandidate?.trim() ?? null;

  const first = candidates[0]?.trim().split(/\s+/)[0];
  if (first) return { fullName, firstName: first };

  const email = typeof claims.email === 'string' ? claims.email : '';
  const local = email.split('@')[0] ?? '';
  // "dennis.mmachoene" reads better as "Dennis" than as itself.
  const guess = local.split(/[._-]+/)[0] ?? '';
  const firstName = guess
    ? guess.charAt(0).toUpperCase() + guess.slice(1)
    : 'there';

  return { fullName, firstName };
}

export const getVerifiedUser = cache(async (): Promise<VerifiedUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) return null;

  const claims = data.claims as unknown as Record<string, unknown>;
  const { fullName, firstName } = deriveNames(claims);

  return {
    id: data.claims.sub,
    email: typeof data.claims.email === 'string' ? data.claims.email : '',
    fullName,
    firstName,
  };
});

/** Use in any Server Component or Server Action that touches user data. */
export async function requireUser(): Promise<VerifiedUser> {
  const user = await getVerifiedUser();
  if (!user) redirect('/?signin=required');
  return user;
}

/**
 * Re-verify immediately before a destructive action. The session may have been
 * revoked since the page was rendered, and account deletion is not something to
 * run on a stale assumption.
 */
export async function reverifyForDestructiveAction(): Promise<VerifiedUser> {
  const supabase = await createClient();
  // getUser() hits the Auth server rather than validating a local token, so a
  // session revoked seconds ago is caught. Slower, and worth it here.
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error('Your session has expired. Please sign in again.');
  }

  const { fullName, firstName } = deriveNames({
    email: data.user.email,
    user_metadata: data.user.user_metadata,
  });

  return {
    id: data.user.id,
    email: data.user.email ?? '',
    fullName,
    firstName,
  };
}

export { POLICY_VERSION };
