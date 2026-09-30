# Candid

An ethical CV-tailoring tool for South African job seekers. You upload your CV,
paste a job advert, and get back a version that expresses **your real
experience** in the advert's language — plus an honest list of what you are
missing.

Two guarantees define the product. Both are enforced in code and proven by
tests, not asserted in marketing copy:

1. **It never fabricates.** Every claim in the output is traced back to your
   original CV. Anything untraceable is blocked and cannot reach an exported
   file, whatever you click.
2. **It never leaks identity.** Your name, email and phone are stripped before
   anything is sent to the AI and reattached afterwards on the server. South
   African ID numbers are redacted and discarded — the database has no column
   for one.

See [`PLAN.md`](./PLAN.md) for the phased build plan and the audit gates.

---

## Current state — all six phases built

| Phase | Status |
|---|---|
| 1 — Foundation and the two guarantees | **Audited, passed** |
| 2 — Auth, consent, data layer (M1, M2) | **Done, awaiting audit** |
| 3 — Tailoring and review UI (M3, M4) | **Done, awaiting audit** |
| 4 — Templates and ATS export (M5) | **Done, awaiting audit** |
| 5 — History, retention, hardening (M6, M7) | **Done, awaiting audit** |
| 6 — Tests, E2E and CI (M8) | **Done, awaiting audit** |

**The full flow runs end to end.** 223 unit tests and 56 Playwright tests pass,
the latter against real Supabase and real Anthropic: sign in, consent gate,
upload a CV carrying a South African ID number, tailor against an advert
containing a prompt-injection attempt, review the integrity report, download
PDF and Word, delete the account. Two separate accounts are also proven unable
to read each other's rows — through the application, and through an unfiltered
query straight to the database. See `AUDIT-PHASE-6.md` for an honest assessment
against the spec's definition of done, and `AUDIT-RESPONSE.md` for the reply to
the independent full-build audit.

## Measured against real data

The tests above are written against fixtures this project invented. That proves
the rules work; it does not prove they work on documents nobody here wrote. So
the same code was run over two public Kaggle datasets released under CC0: 2483
published resumes and 500 resume PDFs drawn across 24 occupational categories.

| Measurement | Sample | Result |
|---|---|---|
| Parser success | 500 real resume PDFs | 99.80%, zero unhandled failures |
| Injected identity removed in full | 500 resumes with a known header | 100% |
| Identity-number over-redaction | 2483 resumes containing no SA IDs | 0.04% of documents |
| Refused claims reaching a document | 23 live tailorings | 0.00% |
| Identifiers reaching the model | 23 live tailorings | 0.00% |
| Tailoring latency | 23 live tailorings | 13.4s mean, 18.8s at p95 |

The live run attempted 25 pairs and completed 23. Two failed on a network
error and are excluded rather than counted as passes. The harness refuses to
report a rate at all until four fifths of the sample has completed, for the
reason in the next section.

Run it with `npm run evaluate` for the offline measurements and
`npm run evaluate:ai` for the live ones. Results are written to
`evaluation/results/` and committed, so any figure quoted here can be traced to
a timestamped file.

### What the measurement found

Six defects that the tests in place at the time had missed. Every one of them
is now covered by a test built from the document that exposed it.

- **An evidence quote longer than 600 characters failed the whole tailoring.**
  A cap chosen by guessing threw away 14 of 25 real CVs, and the user was told
  the service was unavailable.
- **A newline in an employer name deleted entire work histories.** A CV with
  the job title on one line and the employer on the next was told "Your CV does
  not name this organisation" about an employer printed plainly on the page.
- **A bracket in a skills line refused AWS on a CV that lists it.** Splitting
  `AWS (EC2, S3, Route 53, CloudFront)` on the comma recorded `aws ec2` and
  never plain `aws`.
- **Sections the model has no field for silently disappeared.** Projects,
  certifications and awards had nowhere to go in the reply, so a tailored CV
  came out shorter than the one that went in.
- **The residual name scrub shredded a GitHub URL.** It removed the applicant's
  name from the middle of a web address, on word boundaries, exactly as
  designed, producing `github.com/[NAME REDACTED]-[NAME REDACTED]/project`.
  Links are now withheld before the scrub runs and restored at export.
- **Five skills were refused on a CV that states them.** Monitoring, logging,
  code review and backend development were missing from the vocabulary, and
  "Agile methodology" never met "agile methodologies" because nothing compared
  the last letter. A wrong refusal is not a safe failure: it deletes true work
  and tells the applicant their own document does not say what it says.

The harness itself had a fifth: it asserted that no refused claim reached a
document, which is trivially true when every request fails. It now refuses to
report a rate until four fifths of the sample has actually completed.

Account erasure shipped early, in Phase 4, because a settings page in a POPIA
product without a delete button is not a settings page.

### The tests gate the build, and that was tested

Breaking a guarantee turns the suite red. Demonstrated three ways — letting a
blocked claim through the assembler, removing the residual identity scrub, and
flipping the validator's fallthrough from `blocked` to `accepted`. Each was
reverted immediately. The transcript is in `AUDIT-PHASE-6.md`; reproduce it
rather than trusting it.

---

## Running it

First time, follow [`SETUP-PHASE-2.md`](./SETUP-PHASE-2.md): run the migrations,
set up Google sign-in, and fill in `.env.local`. To put it online, see
[`SETUP-DEPLOY.md`](./SETUP-DEPLOY.md). To stop the Google consent
screen naming the Supabase project, see
[`SETUP-VANITY-SUBDOMAIN.md`](./SETUP-VANITY-SUBDOMAIN.md).

To check the whole thing works by hand, follow [`TESTING.md`](./TESTING.md).
It comes with a CV built to trigger every verdict and an advert that tries to
make the system lie.

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run typecheck  # tsc --noEmit
npm run lint       # eslint, including the domain dependency rule
npm test           # vitest — the guarantee proofs
npm run e2e        # playwright — the full flow against real services
npm run build      # production build
```

### Run the checks before every push

```bash
git config core.hooksPath .githooks
```

Once per clone. `.githooks/pre-push` then runs typecheck, lint and the test
suite before any push, and refuses if one fails.

This is **not** branch protection and is not a substitute for it. A hook can be
skipped with `--no-verify`, so it stops accidents rather than decisions. It runs
before you push; the ruleset on `main` is what actually blocks a merge.

Belt and braces: the hook catches the mistake in three seconds on your machine,
CI catches it in ninety on a clean one.

---

## Architecture

Ports and adapters. The domain layer owns the business rules and imports no
vendor SDK, which is what makes the ethical rules testable in isolation and the
AI provider swappable.

```
app/
  actions/               Server Actions — auth, consent, upload
  auth/callback/         OAuth callback Route Handler
  consent/               the POPIA gate
  dashboard/             upload and stored CVs
components/ui/           shadcn/ui components
lib/
  dal.ts                 every authoritative identity check, close to the data
  domain/                PURE — no vendor imports, enforced by ESLint
    types.ts             core types
    ports.ts             AIProvider, CvParser, ResumeRepository, RateLimiter
    identity.ts          Guarantee 1 — strip identity, redact SA ID numbers
    inventory.ts         the verifiable skill inventory
    validator.ts         Guarantee 2 — the anti-fabrication rule
    provenance.ts        employers and dates — named in the source, or blocked
    resume-document.ts   neutral document model + ATS constraints + assembly
    tailoring.ts         the use case that fixes the ordering
    learning.ts          real, checked resources for each gap
    consent.ts           POPIA policy version and named operators
  infrastructure/        adapters — the only place vendors are imported
    env.ts               Zod-validated environment, server-only
    crypto.ts            AES-256-GCM identity-header encryption
    parser.ts            magic-byte validated PDF/DOCX parsing
    claude-provider.ts   AIProvider over Anthropic, structured outputs
    rate-limit.ts        the Postgres limiter — fails closed
    supabase-repo.ts     ResumeRepository over Supabase
    supabase/            browser, server, middleware and admin clients
    export/              pdf-renderer, docx-renderer, shared text preparation
supabase/migrations/     schema, RLS policies, SECURITY DEFINER functions
tests/                   vitest proofs
```

**The dependency rule** — `lib/domain/*` may not import `lib/infrastructure/*`,
`next`, `react`, `@supabase/*`, `@anthropic-ai/*`, or any I/O or parsing
library. This is not a convention; `eslint.config.mjs` fails the build on
violation. To see it work, add `import { createClient } from
'@supabase/supabase-js'` to any domain file and run `npm run lint`.

### Two design decisions worth knowing about

**Ordering is structural, not remembered.** `lib/domain/tailoring.ts` is the
only route to the AI provider, and it de-identifies before it calls. "Never
send identity to Claude" is therefore a property of the call graph rather than a
rule a future contributor has to know.

**Blocked claims have no path to a file.** `assembleResumeDocument` builds the
skills list from the integrity report and never reads `draft.skills`. A blocked
claim cannot be approved into an export, because approval is not the gate — the
report is.

---

**Row-Level Security is the backstop, not the plan.** Both the browser client
and the server client use the **publishable** key, so every query — including
ones made from a Server Action — runs under the user's own session and is
scoped by RLS. The secret key bypasses RLS entirely and is read in exactly one
place, `lib/infrastructure/env.ts`, for admin work only. A bug in application
logic cannot read another user's rows, because the database refuses.

**The original upload is never stored.** It is parsed in memory, de-identified,
and discarded. Only the de-identified text and the encrypted identity header
reach the database. Keeping the original would mean keeping the unredacted ID
number, which is the thing the product promises not to do.

**The export route takes three inputs and none of them is content.** A tailoring
id, a format, and a template id. The document is rebuilt server-side from the
stored integrity report by the same function that renders the on-screen
preview, so a caller who controls every parameter still cannot put a blocked
claim into a file, and the preview and the download cannot drift apart.

---

## What is deliberately absent

- There is **no `id_number` column** anywhere: not in the types, not in the
  identity header, and not in the database schema. The migration says so in a
  comment, in capitals.
- The alias map in `inventory.ts` maps only true synonyms. `JS` ≡ `JavaScript`
  is fair. `React` ≡ `React Native` would be fabrication with extra steps, and
  there is a test asserting it does not happen.
- Gaps are shown in the app but never printed into the exported CV.
