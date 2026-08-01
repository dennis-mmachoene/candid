# Phase 1 — audit handoff

Scope: M0 (scaffold) plus §3, §4 and §5 of the build spec — the architecture and
both guarantees. No credentials, no network calls, no database.

---

## What was verified, and by whom

| Check | Result | Run by |
|---|---|---|
| `npx tsc --noEmit` | passes, 0 errors | Claude (Linux sandbox) |
| `npx eslint` | passes, 0 errors, 0 warnings | Claude |
| Domain dependency rule fires on violation | **demonstrated** — see below | Claude |
| `npx vitest run` | **36 passed, 0 failed** | Claude |
| `npm run dev` loads in a browser | not yet | **Dennis** |
| `npm run build` | not yet | **Dennis** |

`next build` and `next dev` both abort with `Bus error (core dumped)` inside the
Linux sandbox — a hello-world page does the same, so it is the sandbox's
restrictions on Next's native binaries, not this code. Both need to be run on
Windows before this phase is signed off.

### The dependency rule, demonstrated rather than assumed

Adding `import { createClient } from '@supabase/supabase-js'` to
`lib/domain/identity.ts` produced:

```
lib/domain/identity.ts
  359:1  error  '@supabase/supabase-js' import is restricted from being used by
                a pattern. lib/domain must not import a vendor SDK. Depend on a
                port in lib/domain/ports.ts and implement it in
                lib/infrastructure/  no-restricted-imports
```

The probe was then removed. Reproduce it before trusting it.

### One real defect the tests caught

The first fixture ID number (`8001015009088`) had a hand-computed Luhn check
digit that was wrong, so it was **not** being redacted — and the test failed
loudly rather than passing on a number that was never a valid ID in the first
place. The correct check digit is 7. Worth noting because a weaker test (one
that asserted `redactSaIdNumbers` was *called* rather than that the output was
clean) would have gone green on a broken redactor.

---

## What to attack

The tests below all pass. The job is to find what they do not cover.

### Guarantee 1 — de-identification

1. **Is the assertion on the right thing?** `tests/identity.test.ts` asserts on
   `RecordingProvider.everythingReceived` — the literal payload the provider was
   handed by `tailorCv`. Confirm it is not asserting on an intermediate value
   that the real infrastructure adapter could bypass.
2. **Can the provider be reached without `tailorCv`?** The ordering guarantee
   rests entirely on that function being the only route. `grep -rn "\.tailor(" `
   and check.
3. **The name heuristic will miss some names.** `looksLikeName` requires 2–5
   alphabetic words. Single-word names, names with initials ("T. Mokoena"), and
   names carrying a title ("Dr Nomsa Dlamini") behave how? Note that the whole
   header block is withheld regardless, so a miss degrades the *residual scrub*,
   not the header strip — check whether that is enough.
4. **Over-redaction.** Name parts of 3+ characters are scrubbed on word
   boundaries, case-insensitively. Find a realistic CV where this mangles the
   content badly enough to matter.
5. **The Luhn + date filter.** Roughly 3% of random 13-digit runs will pass both
   checks. Is that acceptable, and is the failure direction right?
6. **Phone patterns.** `PHONE_PATTERNS` covers `+27`, `0027`, `0…` and generic
   international. Find an SA number format that escapes all three.
7. **A second call.** If a user uploads a CV, then re-tailors it, is
   de-identification re-run every time or is anything cached?

### Guarantee 2 — anti-fabrication

8. **The alias map is the obvious attack surface.** Read every entry in
   `SKILL_ALIASES`. The rule is "would a recruiter agree these are the same
   competency". Flag any that would let a model claim something the CV does not
   support. There is a test asserting `React ≠ React Native`, `Java ≠
   JavaScript`, `SQL ≠ PostgreSQL` — extend it with anything you find.
9. **Can a blocked claim reach a document?** `assembleResumeDocument` reads only
   from the integrity report. Try to break that: craft an `approved` set
   containing the blocked canonical key (there is a test for this — try
   harder), or find any other function that builds a document.
10. **Bullet-level detection is vocabulary-based.** `claimsInProse` only spots
    skills in `PROSE_MATCHABLE_VOCABULARY`. A fabricated skill *not* in that
    list, mentioned only inside a bullet, will not be caught. How serious is
    that, and what is the right fix — a bigger vocabulary, or a different
    approach entirely?
11. **Fabricated employers and dates.** The spec says never invent skills,
    employers **or dates**. The validator currently judges skills. Employer and
    date verification is not implemented. Confirm this is a real gap and decide
    whether it belongs in Phase 3.
12. **The inference rules.** Read `INFERENCE_RULES`. Each must be defensible in
    an interview. Is "sprints appear in the CV" really enough to infer agile
    methodologies?
13. **Fallthrough direction.** Confirm an unrecognised claim ends up `blocked`,
    not `accepted`, on every path.

### Architecture

14. `grep -rn "from '@supabase\|from '@anthropic\|from 'next'" lib/domain/` —
    expect zero hits.
15. Does `lib/domain` contain any I/O, `Date.now()`, randomness, or other
    non-determinism that would make the rules untestable?
16. Is `TailorRequest` genuinely incapable of carrying identity? Check no field
    could smuggle it.

### Scaffold

17. Versions are pinned exactly in `package.json` — no `^` or `~`. Next is
    **15.5.22**, deliberately not the 16.x that is current, per spec §2.
18. shadcn/ui was set up **by hand** (`components.json`, `lib/utils.ts`,
    `app/globals.css` tokens, `components/ui/{button,card}.tsx`) because
    `ui.shadcn.com` is unreachable from the sandbox. Confirm the tokens and
    component source match what the CLI would have produced, and that
    `npx shadcn@latest add …` works on Windows now that `components.json` exists.
19. `app/layout.tsx` uses a system font stack instead of `next/font/google`, to
    keep the build from depending on a third-party network fetch. Reasonable, or
    should Geist come back via the `geist` npm package?

---

## Known gaps, stated up front

- No `npm run build` or browser verification yet (sandbox limitation above).
- Employer and date fabrication is not validated — only skills.
- Bullet-level claim detection is limited to a fixed vocabulary.
- `lib/infrastructure/` does not exist yet; the ports have no adapters. That is
  Phase 2 and 3 by design.
- No CI. GitHub Actions is Phase 6.
