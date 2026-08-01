# Phase 2 — audit handoff

Scope: M1 (auth + consent gate) and M2 (upload → parse → de-identify → persist),
plus §6 (data model and RLS) and §7 (auth and the DAL).

---

## What was verified, and by whom

| Check | Result | Run by |
|---|---|---|
| `npx tsc --noEmit` | passes, 0 errors | Claude |
| `npx eslint` | passes, 0 errors, 0 warnings | Claude |
| `npx vitest run` | **56 passed, 0 failed** (was 36) | Claude |
| Migration applies cleanly | not yet | **Dennis** |
| Google sign-in works end to end | not yet | **Dennis** |
| Consent gate blocks the dashboard | not yet | **Dennis** |
| Real CV uploads and stores de-identified | not yet | **Dennis** |
| Second account cannot read the first's rows | not yet | **Dennis** |
| Vercel deploy | not yet | **Dennis** |

`SETUP-PHASE-2.md` has the walkthrough, including the Google Cloud steps.

### New tests

**`tests/crypto.test.ts`** — the threat is a database dump, where RLS does
nothing because a dump is not a query. Asserts the ciphertext contains no
readable fragment of the name, email or phone; that a fresh IV is used per
record (a fixed IV would leak whether two rows hold the same identity and break
GCM outright); that altered ciphertext and swapped auth tags are refused rather
than decrypted into something plausible; and that a key not decoding to 32 bytes
is rejected.

**`tests/parser.test.ts`** — every fixture is a real file built at test time by
`pdf-lib` and `docx`, not a hand-written byte string. A test that only checks
four magic bytes proves the check works and nothing about whether the file can
be read. Covers: real PDF and .docx parse correctly; a ZIP that is not a Word
document is refused; a legacy `.doc` gets a useful message; PNG and plain text
are refused; the size cap fires before any parsing library sees the bytes; a
PDF with no text layer (a scan) is refused. The last test runs a real .docx
through parse and de-identify together and asserts nothing identifying survives.

---

## Two deliberate departures from the build spec

Both are flagged here rather than made quietly.

### 1. The original uploaded file is never stored

The spec lists Supabase Storage with private buckets and signed URLs. Candid
does not use it. The uploaded CV is parsed in memory, de-identified, and only
the de-identified text plus the encrypted header is written. The original bytes
are discarded.

The reason: the original file contains the unredacted ID number and full contact
details. Storing it would undo the redaction we just performed, and the spec is
emphatic that ID numbers are never stored. Keeping a copy in a bucket is still
keeping it.

The cost is that a user cannot re-download their original upload. That seems
like the right trade — they already have it, it is their own CV.

**Auditor: challenge this if you disagree.** It is a real deviation.

### 2. Key names follow Supabase's current model

The spec names `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`. Supabase has replaced those with
`sb_publishable_...` and `sb_secret_...` keys and deprecates the JWT-based ones
at the end of 2026. The code uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and
`SUPABASE_SECRET_KEY`. Same roles, current names.

Verified against `https://supabase.com/docs/guides/getting-started/api-keys`,
not from memory.

---

## Version checks that mattered

Supabase's current SSR docs show a root **`proxy.ts`** with an exported `proxy`
function. That is the Next.js 16 rename. This project is pinned to Next 15.5.22,
which still uses `middleware.ts` — confirmed by reading
`node_modules/next/dist/lib/constants.js` (`MIDDLEWARE_FILENAME = 'middleware'`)
rather than trusting either the docs or training data. Following the docs
verbatim would have produced a file Next 15 ignores entirely, and the auth
session would have silently failed to refresh.

`getClaims()` is used rather than `getUser()` or `getSession()` for session
verification, per current Supabase guidance: it verifies the JWT signature
against the project's published keys. `getSession()` reads a cookie without
revalidating, and cookies are attacker-controlled. `getUser()` is used in exactly
one place — `reverifyForDestructiveAction()` — where a round trip to the Auth
server is worth it.

---

## What to attack

### Row-Level Security and the schema

1. **Is RLS on every table?**
   `select relname, relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r';`
   Expect `true` for all eight.
2. **Does every policy scope to `auth.uid()`?** Read them in
   `pg_policies`. Look for any policy with a `using` clause of `true`.
3. **`rate_limits` has RLS enabled and zero policies.** Confirm that actually
   denies. Sign in as a user and try
   `select * from rate_limits` — it should return nothing, and an insert should
   fail.
4. **The SECURITY DEFINER functions.** `consume_rate_limit` and
   `log_audit_event` both set `search_path = ''` and schema-qualify everything.
   Without that, a caller who can create objects in a schema earlier on the
   search path can hijack the elevated privileges. Verify, and check the
   `revoke ... from public` / `grant execute ... to authenticated` pairs.
5. **`consume_rate_limit` takes no user id** — it reads `auth.uid()`. Confirm
   there is no path where a caller supplies one.
6. **Audit logs have no INSERT policy.** Writes go only through
   `log_audit_event`. Confirm a user cannot forge or delete an audit row.
7. **Confirm no `id_number` column exists** anywhere:
   `select table_name, column_name from information_schema.columns where column_name ilike '%id_number%';`
   Expect zero rows.
8. **Cascades.** Every `user_id` references `auth.users(id) on delete cascade`.
   Delete a test auth user and confirm every owned row goes with it.

### The secret key

9. `grep -rn "SUPABASE_SECRET_KEY" app/ lib/ components/` — the only hit should
   be `lib/infrastructure/env.ts`, in a function nothing currently calls. If it
   is read anywhere in a user-facing path, that bypasses RLS for that query and
   is a defect.
10. Confirm both the browser and the server client use the **publishable** key.
    The server one using the same key as the browser is deliberate: server
    queries run under the user's session so RLS applies to them identically.

### Auth and the DAL

11. **Is `getSession()` used anywhere for authorisation?** It should not be.
    `grep -rn "getSession" lib/ app/`.
12. **Does any route trust the client for identity?** The DAL takes nothing from
    the request. Look for anywhere a user id crosses a Server Action boundary.
13. **The OAuth callback.** `app/auth/callback/route.ts` only honours
    same-origin relative redirect paths. Try `?next=//evil.com`,
    `?next=https://evil.com`, `?next=/\evil.com`. An open redirect on an auth
    callback is a phishing primitive.
14. **Middleware is optimistic only.** Confirm that removing the middleware
    redirect entirely still leaves the dashboard protected, because
    `requireConsentedUser()` runs in the page.
15. **Consent version.** `acceptConsent` takes the policy version from a server
    constant, never the form. Confirm a crafted POST cannot consent to a
    version that does not exist.

### Upload

16. **Is `file.type` consulted anywhere?** It should not be.
    `grep -rn "\.type" app/actions/upload.ts lib/infrastructure/parser.ts`.
17. **Rename a `.png` to `.pdf`** and upload it. Should be refused on bytes.
18. **Upload a `.xlsx`.** It is a ZIP like a `.docx`; the `word/document.xml`
    check should refuse it.
19. **A password-protected PDF, and a 200-page PDF.** Both should fail with a
    readable message rather than a stack trace.
20. **Does anything log the CV text or the identity header?** Check every
    `console.error` for an interpolated value that could carry PII.

### Encryption

21. Confirm the IV is generated per call and never reused or configured.
22. Confirm the auth tag is stored and verified, not discarded.
23. Is the key cached in a module variable a problem in a serverless runtime?
    (I think not — the process is per-instance — but say so if you disagree.)

---

## Known gaps, stated up front

1. **No generated database types.** `supabase.from('resumes')` currently returns
   `any`, so a typo in a column name typechecks fine and fails at runtime. Once
   the migration is applied, `supabase gen types typescript` fixes this. It
   should be done before Phase 3 rather than after.
2. **No integration test proves RLS actually isolates users.** The vitest suite
   covers pure logic and infrastructure that runs without a database. Cross-user
   isolation is currently only verifiable by hand. A seeded integration test
   against a local Supabase would be worth having by Phase 6.
3. **`deleteEverything()` is written but unused**, and does not yet delete the
   auth user. That is Phase 5 (M6).
4. **Rate limiting is not wired up.** The Postgres function exists; nothing
   calls it, because the endpoint worth limiting is the Anthropic one and that
   arrives in Phase 3.
5. **No security headers or CSP yet.** `poweredByHeader: false` is set;
   everything else is Phase 5 (M7).
6. **Carried forward from Phase 1, unchanged:** employers and dates are not
   validated (Phase 3, agreed); prose-buried claim detection is vocabulary-bound;
   the name heuristic misses single-word, initialled and titled names.
