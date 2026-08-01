# Phase 6 — final audit handoff

Scope: M8 (test suite, Playwright happy-path, CI) plus the typed database schema
the Phase 2 audit asked for and the following three phases did not deliver.

---

## What was verified, and by whom

| Check | Result | Run by |
|---|---|---|
| `npx tsc --noEmit` | passes, 0 errors | Claude |
| `npx eslint` | passes, 0 errors, 0 warnings | Claude |
| `npx vitest run` | **125 passed, 0 failed** (was 114) | Claude |
| **Breaking a guarantee turns the suite red** | **demonstrated three ways** — see below | Claude |
| `npm run build` | not yet | **Dennis** |
| **Playwright, full suite** | **50 passed, 0 skipped, 0 failed** | Dennis |
| CI goes green on GitHub | not yet | **Dennis** |

**The full flow has now run end to end against real Supabase and real
Anthropic.** Sign in, consent gate, upload a CV containing a valid South
African ID number, de-identification verified in the stored row, tailoring
against an advert carrying a prompt-injection attempt, integrity report, PDF
and DOCX download, account deletion. Every step, on a real instance.

That was the largest outstanding risk in this project for five phases. It is
closed.

---

## The tests gate the build — demonstrated, not asserted

The spec says the ethical tests are the strongest evidence and the build must
fail if they regress. That is a claim about the tests, so it was tested. Three
sabotages, each reverted immediately after:

**1. Let a blocked claim through the document assembler.** Changed `includable`
so a blocked claim is admitted when it appears in the approved set:

```
× still excludes a blocked claim when it has been approved
× keeps them out even if every claim is approved
2 failed | 123 passed
```

**2. Stop scrubbing identifiers from the CV body.** Removed the residual scrub,
leaving only the header strip:

```
× scrubs identifiers that recur below the header
× sends content containing no name, email, phone or ID number
× de-identifies before the provider is called, not after
× still sends nothing identifying, hostile advert or not
4 failed | 121 passed
```

**3. Make the validator fall through to `accepted` instead of `blocked`.**

```
15 failed | 110 passed
```

All three restored; the suite is green. Reproduce any of them before trusting
this section.

---

## The oldest open item is closed

`lib/database.types.ts` types the whole schema, and every Supabase client is
parameterised with it. `supabase.from('resumes')` no longer returns `any`.

**It found a real class of bug immediately.** Every read of a `jsonb` column —
`draft`, `report`, `approved_claims` — was an unchecked cast from `Json` to a
domain type. The compiler had been silent about it only because the client
returned `any`. Fourteen type errors appeared the moment the types were wired
in, all at that boundary.

The fix is `lib/infrastructure/persisted-schemas.ts`: data coming **out** of the
database is now Zod-validated exactly as data coming out of the model is. Same
principle, same boundary discipline.

The failure this prevents is not a wildly malformed row, which would throw
somewhere obvious. It is a row that is *almost* right. An integrity report
missing its `blocked` array reads as "nothing was blocked" — on the one screen
where blocked claims are the entire point. `tests/persisted-records.test.ts`
covers exactly that case.

Approvals are the deliberate exception: a malformed approvals list is read as
"nothing approved" rather than throwing, because that failure direction can only
ever *exclude* content from a document, never include it.

**Caveat, and it matters:** the types are hand-written from the migrations, not
generated, because generating needs a live project. They can drift. Regenerate
at the first opportunity:

```
npx supabase gen types typescript --project-id <ref> > lib/database.types.ts
```

Treat a change to `supabase/migrations/` as a change to that file too.

---

## A second test premise that was wrong

Worth recording, because it is the second time this has happened and both times
the test was wrong rather than the code.

`tests/persisted-records.test.ts` originally asserted that a `Date` in a draft
would be rejected on write. It is not, and should not be: `JSON.stringify` turns
a `Date` into an ISO string, which is a perfectly valid string field. The test
now uses a `Set`, which serialises to `{}` rather than a list — the case that
genuinely matters, because a skills array built from a Set would land in the
column as an empty object and every skill would silently vanish.

---

## End-to-end, without a bypass

`tests/e2e/` has two specs.

**`public.spec.ts` always runs**, no credentials needed. The most valuable test
in it reads the browser console for CSP violations across the landing, privacy
and terms pages. A Content Security Policy fails silently — it does not error,
it just blocks something and the page quietly loses a feature. This is the check
I would otherwise be asking a human to repeat on every page forever.

It also asserts the nonce differs across three requests, that `script-src` never
contains `'unsafe-inline'`, that signed-out visitors are bounced from every
protected route, and that a request for a real-looking CV id is indistinguishable
from one for an invented id.

**`happy-path.spec.ts` skips cleanly when unconfigured.** A suite that goes red
on a laptop without secrets teaches people to ignore red suites.

**There is no test-only code path in the application.** No `E2E_MODE` flag, no
bypass route, nothing that a mis-set environment variable could enable in
production. The test signs in through Supabase's admin `generateLink`, navigates
the resulting URL, and lands on Candid's own `/auth/callback` — the same route
every real user goes through. No cookie forgery either.

Requires the Email provider enabled in Supabase. Sign-ups can stay disabled;
`generateLink` is an admin call.

The tailoring step is gated separately on `ANTHROPIC_API_KEY`, because it spends
real money. Everything before it runs on Supabase alone.

---

## CI

`.github/workflows/ci.yml` gates typecheck, lint, test and build on every push
and pull request to `main`.

The build-time environment variables are deliberately fake placeholders. CI does
not touch a real database, and a workflow that needed production credentials in
order to typecheck would be a workflow that leaks them eventually.

`npm ci` rather than `npm install`: it installs exactly what the lockfile says
and fails if `package.json` and the lockfile disagree.

The end-to-end job runs only on pushes to `main`, so a fork's pull request does
not fail for want of secrets it cannot have.

---

## What to attack

1. **Reproduce the three sabotages above.** Do not take the transcript on trust.
2. **Break something the tests do not cover** and see if anything notices. That
   is the more useful exercise: the gaps below are what I know about.
3. **Run the Playwright suite** and read what it actually asserts. `public.spec`
   should pass on any machine.
4. **Check CI is genuinely blocking.** Open a PR with a deliberately broken
   guarantee test and confirm merge is prevented. Branch protection has to be
   configured in GitHub settings — the workflow alone does not enforce it.
5. **Diff `lib/database.types.ts` against the real schema** once you can
   generate it. Any difference is a latent runtime failure.
6. **Read `persisted-schemas.ts` for over-strictness.** It throws on a malformed
   report. Is there a row shape a previous version of Candid wrote that would
   now fail to load? I believe not — the shapes have not changed since Phase 3 —
   but this is worth checking against real data.

---

## Definition of done — spec §13, honestly assessed

| Requirement | State |
|---|---|
| Signs in with Google | Built; the E2E suite uses a real Supabase session rather than driving Google's UI |
| Accepts consent notice | **Verified on a real instance** |
| Uploads a real CV | **Verified on a real instance** |
| Tailored version with correct integrity report | **Verified against the real Anthropic API** |
| No fabricated claims | Proven by tests three ways, and by a real injected advert |
| ID number redacted | Proven by tests, and verified in the stored row |
| Identity never sent to the model | Proven by tests, on the real payload |
| Approves borderline wording | **Verified on a real instance** |
| Downloads ATS-parseable PDF and DOCX | **Both downloaded from a running instance**; round-trip proven through real parsers |
| Sees their history | Built; **not yet verified across two accounts** |
| Deletes everything they own | **Verified on a real instance** |
| `typecheck`, `lint`, `test` | Verified locally |
| `build` passes | **Unverified** |
| CI green on GitHub | **Unverified** |

**Substantially done.** What remains is `npm run build`, CI, and one check no
automated test covers: that two real accounts cannot see each other's rows.

---

## Known gaps, carried to the end

1. ~~**The authenticated flow has never run.**~~ **Closed.** 50 of 50 tests
   pass against real Supabase and real Anthropic, including a tailoring with a
   prompt-injection attempt in the advert and both file downloads.
2. **`lib/database.types.ts` is hand-written** and can drift from the schema.
3. **No test proves RLS isolates two real users.** Still only verifiable by
   hand, and still not done. A seeded integration test against a local Supabase
   is the right answer and does not exist.
4. ~~**The CSP has never run in a browser.**~~ **Closed.** Playwright ran the
   public suite on Windows: 0 CSP violations across `/`, `/privacy` and
   `/terms`, a fresh nonce on every request, and the theme surviving a reload —
   which also proves the nonce is reaching the inline script next-themes writes
   before paint. This was the largest untested risk from Phase 5.
5. **`style-src 'unsafe-inline'`**, documented in Phase 5 with an upgrade path.
6. **Employer detection is heuristic.** It will have both misses and false
   positives. Single-word lowercase company names and companies named without a
   preposition are the known holes.
7. **Prose-buried skill detection is vocabulary-bound.** A fabricated skill
   outside `PROSE_MATCHABLE_VOCABULARY`, mentioned only in a bullet, is not
   caught. The skills array is checked regardless, so the exposure is narrow.
8. **The name heuristic misses** single-word, initialled and titled names. The
   header block is withheld wholesale, so the degradation is only to the
   residual scrub.
9. **The DOCX heading decision** — bold paragraphs rather than `HeadingLevel` —
   is a judgement call about parser behaviour, not a proven fact.
10. **`gaps` from the model are not validated** against the advert. They are
    shown to the user and never printed on the CV, so the blast radius is small.
11. **No monitoring or alerting.** A failing rate limiter or a spike in blocked
    claims would be invisible.
