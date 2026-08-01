import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/lib/database.types';

/**
 * Browser client. Uses the publishable key, which is safe to ship to a browser
 * precisely because Row-Level Security applies to it.
 *
 * Reads `process.env` directly rather than going through `lib/infrastructure/env.ts`,
 * because that module is `server-only` and importing it here would be a build
 * error. Next inlines `NEXT_PUBLIC_*` at build time, so these are real values
 * by the time this runs.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
