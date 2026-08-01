# Phase 3 — audit handoff

Scope: M3 (tailoring, anti-fabrication, review UI) and M4 (gaps and learning
resources), plus §11 (Claude integration). Also closes the employer-and-date gap
the Phase 1 audit named as the priority.

---

## What was verified, and by whom

| Check | Result | Run by |
|---|---|---|
| `npx tsc --noEmit` | passes, 0 errors | Claude |
| `npx eslint` | passes, 0 errors, 0 warnings | Claude |
| `npx vitest run` | **68 passed, 0 failed** (was 56) | Claude |
| A real CV plus a real advert produces a draft | not yet | **Dennis** |
| The literal request body carries no identity | not yet | **Dennis** |
| Rate limit trips and cannot be reset from the client | not yet | **Dennis** |

Everything from Phase 2 is still outstanding on Dennis's side too: the
migration, Google sign-in, and the upload walkthrough.

---

## The Phase 1 gap is closed

The independent audit said employer and date fabrication was the thing to
prioritise, and it was right. `lib/domain/provenance.ts` now extracts
organisations and dates from generated prose and judges them.

The rule is stricter than the one for skills, deliberately. A skill can be a
fair inference — "led a team of five" really does evidence team leadership. An
employer cannot be inferred from anything: either the CV names it or the model
invented it. So there is **no borderline verdict on that path**. Named in the
source, or blocked.

**One real defect the tests caught.** The first implementation only detected
multi-word proper nouns, so "Absa Bank" was caught and **"Google" was not**.
Single-word employers — Google, Absa, Vodacom, Shoprite, Discovery — are most of
them. The fix detects the preposition that introduces an employer
("worked **at** Google"), and skips phrases that are known technologies so that
"worked with Kubernetes" is judged as a skill and gets a message that makes
sense.

---

## Three layers, and only one of them holds

Worth being precise about, because these are routinely conflated:

1. **Prompt-injection defence** stops the advert being read as instructions. It
   reduces the chance of a steered reply. It does not eliminate it.
2. **Structured outputs** guarantee the reply's *shape*. The API enforces the
   JSON schema server-side, so prose, markdown fences and missing fields cannot
   reach us.
3. **The domain validator** guarantees the reply's *content*. This is the one
   that actually holds.

`tests/prompt-injection.test.ts` assumes layers 1 and 2 have **already failed**.
Every test in it hands the validator exactly the draft a fully compromised model
would produce — Kubernetes and Terraform in `skills`, "Worked at Google from
2015" in a bullet — and asserts the fabrication still cannot reach a document,
including when every claim is approved.

That is the property worth having. A design that relied on prompting would be a
design that trusts the model, and this product exists because you cannot.

---

## Version checks that mattered

`@anthropic-ai/sdk` 0.115.0 supports **structured outputs** via
`client.messages.parse()` with `output_config.format: zodOutputFormat(schema)`.
This is better than the spec's "request JSON output and validate it with Zod",
because the schema is enforced by the API rather than hoped for in a prompt. The
reply is still re-validated with our own strict schema afterwards, so a change
to the SDK or a future switch to a provider without structured outputs cannot
quietly let an unvalidated object into the domain.

Verified by reading the installed type definitions, and by running
`zodOutputFormat` against our Zod 4.4.3 to confirm the versions agree.

`ANTHROPIC_MODEL` is pinned to `claude-haiku-4-5-20251001`, a dated snapshot
rather than the moving `claude-haiku-4-5` alias. An alias means the model can
change under a build that already passed its tests, and the thing being tested
here is honesty.

---

## What to attack

### Prompt injection

1. **Paste a genuinely hostile advert** through the running app and read the
   integrity report. Try: instructions in the advert, an advert that claims to
   be a system message, an advert containing a fake JSON reply, an advert
   written in another language.
2. **Try to close the fence.** The advert is wrapped in
   `===UNTRUSTED-<uuid>===`, generated per request. Confirm there is no fixed
   delimiter an attacker could write into their advert to appear to close it.
3. **Try to reach `skills` rather than `gaps`.** Even if you succeed, the
   validator should block it. Find a phrasing where it does not.
4. Does anything in the advert reach the **system** prompt? It should be in the
   user turn only.

### The Zod boundary

5. `draftSchema` is `.strict()` with caps on every array and string. Confirm an
   over-long or over-full reply is refused rather than truncated.
6. What happens when `parsed_output` is null? Should throw, not proceed.
7. Are Anthropic error objects ever returned to the user? They can carry request
   ids and internal detail. `grep` the catch blocks.

### Employers and dates

8. **Find an employer shape the extractor misses.** Lowercase company names
   ("upwork"), companies whose name is a common word ("Discovery", "Standard"),
   punctuated forms ("Absa (Pty) Ltd"), and employers named without a
   preposition are the obvious candidates. This is a heuristic and it will have
   holes.
9. **Find a false positive that damages a real CV.** A flagged phrase drops the
   whole bullet, which is the safe direction and an annoying one. How often does
   it fire on honest drafts?
10. Dates are matched as bare four-digit years. A draft saying "March 2020"
    where the CV says "2020" passes. Is that right? I think so — the year is the
    load-bearing part — but argue it.

### Rate limiting

11. **Does it fail closed?** Break the RPC (rename the function in a scratch
    database) and confirm tailoring is denied rather than allowed.
12. Confirm the limit is consumed **before** the Anthropic call, not after. A
    limiter that only counts successful calls does not cap spend on failures.
13. Try to write to `rate_limits` directly as a signed-in user. Should fail.

### Identity, again

14. Add a temporary log of the literal request body in `claude-provider.ts`,
    run a real tailoring, and read it. Any name, email, phone, ID number?
15. `tailorCv` re-runs `deidentify()` on content that is already de-identified.
    That is deliberate defence in depth, and it required making
    `splitHeaderBlock` idempotent — it no longer cuts a fixed six lines when no
    section heading is found. **Check that change carefully.** If it is wrong in
    the other direction, a CV without conventional headings could have its
    header forwarded.

### Learning resources

16. **Click every link in `lib/domain/learning.ts`.** They are asserted to be
    real, first-party where possible, and free-first. A tool built on not
    fabricating things should not fabricate a URL. If any 404s, that is a defect
    in the same category as everything else here.
17. The fallback is a Coursera and YouTube search link rather than an invented
    course page. Is that the right call?

---

## Known gaps, stated up front

1. **No generated database types, still.** `supabase.from(...)` returns `any`.
   This should have been done before Phase 3 and was not, because the migration
   has not been applied yet. It is now the oldest open item.
2. **Employer detection is heuristic.** See items 8 and 9 above. It will have
   both misses and false positives. The failure direction is safe (blocking) but
   the misses are real.
3. **Prose-buried skill detection is still vocabulary-bound.** A fabricated
   skill outside `PROSE_MATCHABLE_VOCABULARY`, mentioned only in a bullet, is
   still not caught. Carried from Phase 1.
4. **The name heuristic still misses** single-word, initialled and titled names.
   Carried from Phase 1.
5. **No test exercises the real Anthropic API.** Everything is against fakes.
   That is correct for unit tests and means the actual prompt has never been
   run. Dennis's manual pass is the first real execution.
6. **Gaps come from the model, unvalidated.** Unlike skills, the `gaps` array is
   passed through. It is shown to the user and never printed on the CV, so the
   blast radius is small, but a model could in principle list a gap that is not
   in the advert. Worth deciding whether that matters.
7. **No security headers or CSP yet.** Phase 5.
8. **`deleteEverything()` still unused**, auth-user deletion still not
   implemented. Phase 5.
