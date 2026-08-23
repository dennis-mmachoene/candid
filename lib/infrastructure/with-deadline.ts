/**
 * Bound how long we will wait for something.
 *
 * This is its own module, with no Next.js and no Supabase import, so the
 * behaviour can be tested against a promise that never settles — which is the
 * exact case that motivated it and the exact case a try/catch cannot express.
 *
 * The distinction it encodes is worth stating plainly, because getting it wrong
 * took production down: catching an error handles a call that *fails*, and does
 * nothing for a call that *never returns*. When Supabase Auth cannot reach its
 * host it does not reject — it raises AuthRetryableFetchError internally and
 * retries. The promise stays pending. In middleware, which runs on every
 * request, a pending promise is a total outage: the platform kills the function
 * at its own limit and every route answers 504, including pages that need no
 * authentication.
 */

/** Returned in place of a value when the deadline is reached first. */
export const TIMED_OUT = Symbol('timed-out');

export type Deadlined<T> = T | typeof TIMED_OUT;

/**
 * Resolve with the work's value, or with `TIMED_OUT` once `ms` has elapsed.
 *
 * Rejections still propagate — a call that fails quickly should be handled as a
 * failure, not disguised as a timeout. Only silence is converted.
 *
 * The losing promise gets a no-op catch attached. Without it, a rejection
 * arriving after the race has already settled has no handler and surfaces as an
 * unhandled rejection, which in a serverless runtime is reported as a crash.
 *
 * The timer is always cleared. Leaving it pending keeps the event loop alive
 * and can hold a function open past the point it should have been torn down.
 */
export async function withDeadline<T>(
  work: Promise<T>,
  ms: number,
): Promise<Deadlined<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const deadline = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });

  work.catch(() => {});

  try {
    return await Promise.race([work, deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
