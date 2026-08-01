import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { publicEnv } from '../env';

/**
 * Server client for Server Components, Server Actions and Route Handlers.
 *
 * Note which key this uses: the **publishable** one, the same key the browser
 * gets. That is deliberate. Running server queries under the user's own session
 * means Row-Level Security applies to them exactly as it does to the browser,
 * so a bug in application logic cannot read another user's rows. Reaching for
 * the secret key here would turn RLS off for every query in the app and leave
 * data isolation resting entirely on our own `where` clauses.
 *
 * A new client per request, never a shared one — the client carries the
 * caller's session, and sharing it across requests would mean sharing that.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = publicEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies. This is expected and safe:
            // middleware refreshes the session and writes the cookies back, so
            // nothing is lost by swallowing it here.
          }
        },
      },
    },
  );
}
