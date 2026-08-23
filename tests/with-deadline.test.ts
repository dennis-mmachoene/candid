import { describe, expect, it, vi } from 'vitest';

import { TIMED_OUT, withDeadline } from '@/lib/infrastructure/with-deadline';

/**
 * These exist because of an outage.
 *
 * Middleware caught errors from the auth check and treated a failure as "not
 * signed in", which was correct and insufficient. When Supabase could not be
 * reached the call did not fail — it hung, retrying internally, and the
 * platform killed the function at its own limit. Every route answered 504,
 * including the landing page, which needs no authentication.
 *
 * The first test below is the one that matters: a promise that never settles.
 * No try/catch can express it, which is precisely why the original fix looked
 * complete and was not.
 */
describe('a call that never returns', () => {
  it('resolves to TIMED_OUT rather than hanging', async () => {
    const neverSettles = new Promise<string>(() => {});

    const result = await withDeadline(neverSettles, 20);

    expect(result).toBe(TIMED_OUT);
  });

  it('gives up close to the budget rather than long after it', async () => {
    const started = Date.now();

    await withDeadline(new Promise<string>(() => {}), 40);

    // Generous upper bound: the assertion is that a deadline exists at all,
    // not that timer scheduling is precise on a loaded CI runner.
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});

describe('a call that does return', () => {
  it('passes the value straight through', async () => {
    const result = await withDeadline(Promise.resolve('claims'), 1_000);

    expect(result).toBe('claims');
  });

  it('is not delayed by the deadline it was given', async () => {
    const started = Date.now();

    await withDeadline(Promise.resolve('claims'), 5_000);

    expect(Date.now() - started).toBeLessThan(500);
  });
});

describe('a call that fails', () => {
  /**
   * Rejections are deliberately not converted into timeouts. A call that fails
   * quickly is a different condition from one that goes silent, and the caller
   * logs them differently — collapsing the two would hide which happened.
   */
  it('propagates the rejection instead of reporting a timeout', async () => {
    const failing = Promise.reject(new Error('AuthApiError'));

    await expect(withDeadline(failing, 1_000)).rejects.toThrow('AuthApiError');
  });
});

describe('cleanup', () => {
  it('clears its timer once the work settles', async () => {
    const clear = vi.spyOn(globalThis, 'clearTimeout');

    await withDeadline(Promise.resolve('claims'), 5_000);

    expect(clear).toHaveBeenCalled();
    clear.mockRestore();
  });

  /**
   * A rejection arriving after the race has settled has no handler attached,
   * and an unhandled rejection in a serverless runtime is reported as a crash.
   * `withDeadline` attaches a no-op catch to the losing promise for this.
   */
  it('does not leave an unhandled rejection behind a timeout', async () => {
    let rejectLate: (reason: Error) => void = () => {};
    const slowThenFails = new Promise<string>((_, reject) => {
      rejectLate = reject;
    });

    const result = await withDeadline(slowThenFails, 20);
    expect(result).toBe(TIMED_OUT);

    // The work fails only after the deadline has already been reported.
    rejectLate(new Error('AuthRetryableFetchError'));
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
});
