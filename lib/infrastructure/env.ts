import 'server-only';

import { z } from 'zod';

/**
 * Environment validation.
 *
 * Two things this file is for. The obvious one is failing loudly at startup
 * rather than at 2am with a confusing runtime error. The less obvious one is
 * that it is the single place the secret key is read, which makes "is the
 * secret key used in a user-facing path?" a question you can answer by reading
 * one function instead of grepping hopefully.
 *
 * `import 'server-only'` makes importing this from a Client Component a build
 * error, not a runtime surprise.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  // Publishable key (`sb_publishable_...`), formerly the anon key. Subject to
  // Row-Level Security, so it is safe in the browser by design.
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url(),
});

const encryptionSchema = z.object({
  // 32 bytes, base64-encoded. Length is checked after decoding, in crypto.ts,
  // because a base64 string of the wrong length is the failure mode that
  // silently produces a weaker key.
  ENCRYPTION_KEY: z.string().min(1),
});

const aiSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  // Pinned to a dated snapshot rather than a moving alias like
  // `claude-haiku-4-5`. An alias means the model can change under a build that
  // passed its tests, and the thing being tested here is honesty.
  ANTHROPIC_MODEL: z.string().min(1),
});

/**
 * Read only in `lib/infrastructure/supabase/admin.ts`. Bypasses RLS entirely.
 */
const adminSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
});

function read<T extends z.ZodType>(schema: T, label: string): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    // Names only. Never interpolate a value here — this string reaches logs.
    throw new Error(`Invalid ${label} environment configuration. ${missing}`);
  }
  return result.data;
}

export function publicEnv() {
  return read(publicSchema, 'public');
}

export function encryptionEnv() {
  return read(encryptionSchema, 'encryption');
}

export function aiEnv() {
  return read(aiSchema, 'AI provider');
}

/**
 * Only the admin module may call this. Anything user-facing that reaches for
 * the secret key is a bug: it bypasses Row-Level Security, which is the
 * backstop the whole data-isolation story rests on.
 */
export function adminEnv() {
  return read(adminSchema, 'admin');
}
