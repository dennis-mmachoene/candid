import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';

import { createClient } from './infrastructure/supabase/server';
import { POLICY_VERSION, requiresReconsent } from './domain/consent';

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
}

export const getVerifiedUser = cache(async (): Promise<VerifiedUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) return null;

  const claims = data.claims;
  return {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : '',
  };
});

/** Use in any Server Component or Server Action that touches user data. */
export async function requireUser(): Promise<VerifiedUser> {
  const user = await getVerifiedUser();
  if (!user) redirect('/?signin=required');
  return user;
}

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

export const getConsentStatus = cache(
  async (): Promise<{ consented: boolean; version: string | null }> => {
    const user = await getVerifiedUser();
    if (!user) return { consented: false, version: null };

    const supabase = await createClient();
    // RLS restricts this to the caller's own rows. There is no user_id filter
    // here because there is nothing to filter — the policy already did it.
    const { data, error } = await supabase
      .from('consent_records')
      .select('policy_version')
      .order('accepted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return { consented: false, version: null };

    return {
      consented: !requiresReconsent({ policyVersion: data.policy_version }),
      version: data.policy_version,
    };
  },
);

/**
 * The consent gate. A user who has not accepted the current policy version
 * cannot reach anything that processes their CV.
 *
 * Re-consent is required when the policy version changes, not merely when
 * consent is absent. If the operator list changes — say an AI provider starts
 * receiving something it did not before — old consent stops counting, which is
 * the entire reason the version is recorded.
 */
export async function requireConsentedUser(): Promise<VerifiedUser> {
  const user = await requireUser();
  const { consented } = await getConsentStatus();
  if (!consented) redirect('/consent');
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

  return { id: data.user.id, email: data.user.email ?? '' };
}

export { POLICY_VERSION };
