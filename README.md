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

## Current state — Phase 3 complete

| Phase | Status |
|---|---|
| 1 — Foundation and the two guarantees | **Audited, passed** |
| 2 — Auth, consent, data layer (M1, M2) | **Done, awaiting audit** |
| 3 — Tailoring and review UI (M3, M4) | **Done, awaiting audit** |
| 4 — Templates and ATS export (M5) | Not started |
| 5 — Lifecycle and hardening (M6, M7) | Not started |
| 6 — Tests, E2E and CI (M8) | Not started |

---

## Running it

First time on Phase 2, follow [`SETUP-PHASE-2.md`](./SETUP-PHASE-2.md): run the
migration, set up Google sign-in, and fill in `.env.local`.

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run typecheck  # tsc --noEmit
npm run lint       # eslint, including the domain dependency rule
npm test           # vitest — the guarantee proofs
npm run build      # production build
```

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
    supabase/            browser, server and middleware clients
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

---

## What is deliberately absent

- There is **no `id_number` column** anywhere: not in the types, not in the
  identity header, and not in the database schema. The migration says so in a
  comment, in capitals.
- The alias map in `inventory.ts` maps only true synonyms. `JS` ≡ `JavaScript`
  is fair. `React` ≡ `React Native` would be fabrication with extra steps, and
  there is a test asserting it does not happen.
- Gaps are shown in the app but never printed into the exported CV.
