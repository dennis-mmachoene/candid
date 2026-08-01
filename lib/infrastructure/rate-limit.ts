import 'server-only';

import { createClient } from './supabase/server';
import type { RateLimiter } from '@/lib/domain/ports';

/**
 * Rate limiting via the Postgres SECURITY DEFINER function.
 *
 * No Redis, no vendor. The counter lives in a table with RLS enabled and not
 * one policy, so a user cannot read it, reset it, or inflate their allowance —
 * the only way in is `consume_rate_limit()`, which takes the caller from
 * `auth.uid()` rather than from an argument.
 *
 * **It fails closed.** If the RPC errors, times out, or returns something
 * unexpected, the caller is denied. The alternative is a limiter that stops
 * working exactly when the database is under stress, which is when you need it.
 * A user occasionally seeing "try again in a minute" during an outage is a far
 * better failure than an uncapped bill on a paid API.
 */

export const LIMITS = {
  /**
   * The only endpoint that costs money. Ten tailorings an hour is generous for
   * a genuine job seeker and useless to someone burning credit.
   */
  tailor: { limit: 10, windowSeconds: 3600 },
  upload: { limit: 20, windowSeconds: 3600 },
} as const;

export type LimitedAction = keyof typeof LIMITS;

export class PostgresRateLimiter implements RateLimiter {
  async consume(action: string): Promise<boolean> {
    const config = LIMITS[action as LimitedAction];
    if (!config) {
      // An unknown action is a programming error. Denying is the safe reading:
      // it fails loudly in development rather than silently uncapping in
      // production.
      console.error('[rate-limit] unknown action', action);
      return false;
    }

    try {
      const supabase = await createClient();
      const { data, error } = await supabase.rpc('consume_rate_limit', {
        p_action: action,
        p_limit: config.limit,
        p_window_seconds: config.windowSeconds,
      });

      if (error) {
        console.error('[rate-limit] rpc failed', error);
        return false;
      }

      // The function returns a boolean. Anything else means the schema and the
      // code have drifted apart, which is not a moment to give the benefit of
      // the doubt.
      if (typeof data !== 'boolean') {
        console.error('[rate-limit] unexpected response shape', typeof data);
        return false;
      }

      return data;
    } catch (cause) {
      console.error('[rate-limit] threw', cause);
      return false;
    }
  }
}

export const rateLimiter: RateLimiter = new PostgresRateLimiter();

/** Human-readable window, for the message shown when someone is limited. */
export function describeWindow(action: LimitedAction): string {
  const seconds = LIMITS[action].windowSeconds;
  if (seconds >= 3600) {
    const hours = seconds / 3600;
    return hours === 1 ? 'an hour' : `${hours} hours`;
  }
  return `${Math.round(seconds / 60)} minutes`;
}
