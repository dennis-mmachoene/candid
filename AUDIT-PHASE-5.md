# Phase 5 — audit handoff

Scope: M7 (security headers, CSP, error sanitisation) and the remainder of M6
(history list, scheduled retention purge). Erasure shipped in Phase 4.

---

## What was verified, and by whom

| Check | Result | Run by |
|---|---|---|
| `npx tsc --noEmit` | passes, 0 errors | Claude |
| `npx eslint` | passes, 0 errors, 0 warnings | Claude |
| `npx vitest run` | **114 passed, 0 failed** (was 98) | Claude |
| Every `console.error` audited for PII | **done** — two hardened, see below | Claude |
| **CSP does not break the app in a browser** | **verified** — Playwright, 0 violations across `/`, `/privacy`, `/terms` | Dennis |
| **Nonce differs on every request** | **verified** — Playwright | Dennis |
| **Theme survives reload** (proves the nonce reaches next-themes) | **verified** — Playwright | Dennis |
| **Signed-out visitors bounced from every protected route** | **verified** — Playwright | Dennis |
| Migration `0003` applies, pg_cron schedules | not yet | **Dennis** |
| History list shows only your own rows | not yet | **Dennis** |

---

## The policy version has changed, deliberately

`POLICY_VERSION` moved from `2026-08-01` to `2026-08-02`, because a new consent
statement was added: the twelve-month retention period.

**This means you will be asked to consent again.** That is the mechanism
working, not a bug, and it is worth watching happen: sign in and confirm you are
sent back to `/consent` rather than straight to the dashboard.

If the operator list or the data flows ever change for real, this is what
protects the user from being bound by terms they never saw.

---

## Retention

Twelve months of inactivity, then a CV and everything tailored from it is
deleted. Tailoring or downloading resets the clock via `touch_resume_access`.

Twelve rather than three: job searches are long, people come back to a CV they
wrote last year, and a tool that silently deleted their work after a quarter
would be worse than useless to the people this is built for.

The number appears in three places on purpose — `RETENTION_MONTHS` in the domain
layer, the consent notice the user reads, and the migration that enforces it. A
retention period nobody is told about is not a policy, it is a habit.

Audit logs are kept longer, at twenty-four months, and that is deliberate: they
carry no CV text and no identity, only actions and counts, and they are the
record of what was done to whom.

---

## Two logs hardened

The audit of every `console.error` found twenty call sites. Eighteen log only
error objects, ids and counts. Two were changed:

1. **`claude-provider.ts`, request failure.** Was logging the whole Anthropic
   error. An `APIError` carries headers and, on a 400, a message that can echo
   part of the request — and the request contains the user's experience. Now
   logs `{ status, name }` only.
2. **`claude-provider.ts`, schema failure.** Was logging `error.issues`. Zod 4
   issues do not serialise the input today, but the reply is derived from the
   user's CV, and "does not today" is not a property to build a privacy
   guarantee on. Now logs `code`, `path` and `message` only.

Logs are the one place PII leaks quietly and stays leaked.

---

## The CSP, and one honest compromise

Nonce-based with `strict-dynamic`, verified against Next's current guidance
rather than recalled. Two details from it are load-bearing and easy to get
wrong:

- The nonce is set on the **request** headers as well as the response. Next
  reads the CSP off the incoming request during SSR and stamps the nonce onto
  its own framework and bundle scripts. Setting it only on the response leaves
  every Next script blocked by the policy you just wrote.
- Nonces force dynamic rendering. That costs nothing here: every page already
  reads cookies through the header's session check, so nothing was static.

**`style-src` allows `'unsafe-inline'`.** This is a documented compromise, not
an oversight, and there is a test asserting it stays deliberate.

The reasoning: style injection is a materially weaker vector than script
injection — it can deface and, with effort, exfiltrate limited data through
selectors, but it cannot execute. Going nonce-only on styles requires verifying
in a **production** build that nothing Next or React injects inline, and that
verification has not been done from here. Shipping an untested policy and having
it break the app in front of a user is worse than a scoped compromise written
down.

**Upgrade path:** once someone can test a production build, drop
`'unsafe-inline'` and add `'nonce-${nonce}'` to `style-src`. The test in
`tests/security-headers.test.ts` will fail, which is the prompt to think about
it.

---

## What to attack

### CSP

1. **Open the browser console on every page.** Any CSP violation is a real
   defect. Check the landing page, consent, dashboard, tailor, review, settings
   and history, in both light and dark mode.
2. **Confirm the theme does not flash on load.** next-themes injects an inline
   script before paint; it is passed the nonce from `x-nonce`. If the nonce
   plumbing is broken, that script is blocked and the flash returns.
3. **Check the nonce differs on every request.** Reload and read the header.
4. **Try to inject a script.** Paste `<script>alert(1)</script>` into a job
   advert and into a CV. It should never execute, and CSP should be the second
   line of defence rather than the first.
5. **Run the deployed URL through securityheaders.com** once it is on Vercel.
6. `upgrade-insecure-requests` is production-only. Confirm it is absent locally
   and present on Vercel.

### Retention

7. **Does `purge_inactive_data()` actually delete the whole tree?** Set a test
   row's `last_accessed_at` to two years ago and run it. Check
   `extracted_skills` and `tailored_resumes` went with it.
8. **Is it callable by a user?** It is `SECURITY DEFINER` with `revoke ... from
   authenticated`. Sign in and try `select public.purge_inactive_data()`. It
   should be refused.
9. **Does `touch_resume_access` respect RLS?** It is `SECURITY INVOKER`
   deliberately, so a user cannot keep somebody else's data alive by touching
   their id. Try it with another user's resume id.
10. **Is pg_cron actually scheduled?** `select * from cron.job;` should show
    `candid-retention-purge`. If pg_cron was not enabled when the migration ran,
    it prints a notice and schedules nothing — check for that rather than
    assuming.

### History

11. **Create two accounts and confirm the history lists do not cross.** This is
    the RLS test that has never been done by hand and should be.
12. The list is capped at fifty rows with no pagination. Is that acceptable?
13. `listTailorings` joins `job_descriptions` and returns a 160-character
    excerpt rather than the full advert. Confirm the full text is not being
    shipped to the browser.

### Errors

14. **Force each failure path and read what the user sees.** Bad file, oversized
    file, rate limit exceeded, expired session on delete, malformed export
    request. No stack trace, no table name, no vendor error should appear.
15. `grep -rn "console.error" app/ lib/` and check every interpolated value
    yourself. I did this; do not take my word for it.

---

## Known gaps, stated up front

1. **Still no generated database types.** Four phases old now. `supabase.from()`
   returns `any`, and the new `listTailorings` join is exactly the kind of query
   where a column typo would compile and fail at runtime. This should be done
   before Phase 6.
2. **The CSP has never run in a browser.** Sandbox limitation. Item 1 above is
   the most important thing on Dennis's list.
3. **`style-src 'unsafe-inline'`**, documented above.
4. **No test proves RLS isolates two real users.** Still only verifiable by
   hand. A seeded integration test belongs in Phase 6.
5. **No E2E test and no CI.** Phase 6.
6. **Carried forward, unchanged:** employer detection is heuristic; prose-buried
   skill detection is vocabulary-bound; the name heuristic misses single-word,
   initialled and titled names; the DOCX heading decision is a judgement call.
