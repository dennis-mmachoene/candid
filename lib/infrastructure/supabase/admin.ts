import 'server-only';

import { createClient } from '@supabase/supabase-js';

import { adminEnv, publicEnv } from '../env';
import type { Database } from '@/lib/database.types';

/**
 * The admin client. It bypasses Row-Level Security entirely.
 *
 * **This is the only file in the project permitted to read the secret key.**
 * If `SUPABASE_SECRET_KEY` appears anywhere else, that is a defect: it turns
 * RLS off for whatever query uses it, and RLS is the backstop the entire
 * data-isolation story rests on.
 *
 * It exists for exactly one thing today — deleting a user from `auth.users`,
 * which the user's own session cannot do. Every other operation in the app runs
 * under the caller's session with the publishable key.
 *
 * The caller must have already verified the session. This module verifies
 * nothing; it is a privileged tool, and handing it an unverified user id would
 * let anyone delete anyone.
 */

export function createAdminClient() {
  const { SUPABASE_SECRET_KEY } = adminEnv();
  const { NEXT_PUBLIC_SUPABASE_URL } = publicEnv();

  return createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      // No session persistence and no refresh: this client is not a user, and
      // a privileged client that quietly holds a session is a liability.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Delete a user from Supabase Auth.
 *
 * Every table cascades from `auth.users`, so this alone erases everything they
 * own. The application-level delete that runs first is belt to this braces: it
 * makes the rows go away even if the auth deletion is what fails.
 */
export async function deleteAuthUser(userId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error('[admin] auth user deletion failed', error);
    throw new Error('Your account could not be fully deleted. Please try again.');
  }
}
