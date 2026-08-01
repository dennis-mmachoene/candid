# Phase 4 — audit handoff

Scope: M5 (templates and ATS-parseable export) and §9. Also pulls M6's erasure
forward from Phase 5, because a settings page in a POPIA product without a
delete button is not a settings page.

---

## What was verified, and by whom

| Check | Result | Run by |
|---|---|---|
| `npx tsc --noEmit` | passes, 0 errors | Claude |
| `npx eslint` | passes, 0 errors, 0 warnings | Claude |
| `npx vitest run` | **98 passed, 0 failed** (was 68) | Claude |
| Secret key confined to `admin.ts` | **verified by grep** — 2 hits, both in `admin.ts` and `env.ts` | Claude |
| A real PDF and DOCX open correctly in a reader | not yet | **Dennis** |
| Account deletion removes everything | not yet | **Dennis** |
| Migration `0002` applies | not yet | **Dennis** |

---

## The round-trip tests are the point of this phase

The easy test to write here would be "a file was produced and has bytes". It
proves nothing. An applicant tracking system does not care that a PDF exists; it
cares whether it can read the candidate's name back out.

So `tests/ats-round-trip.test.ts` renders every template to both formats and
reads each one back **through the same libraries Candid ingests with** —
`unpdf` for PDF, `mammoth` for DOCX. It asserts the name, the email, the
experience bullets, the keywords and the section headings all survive.

Three assertions worth singling out:

1. **The DOCX is unzipped and its XML inspected directly**, not just its
   extracted text. `mammoth` reads text out of a table perfectly happily, so
   asking mammoth whether the document contains a table would always answer no.
   The test asserts the raw `word/document.xml` contains no `w:tbl`,
   `w:drawing`, `w:pict` or `w:txbxContent`, and that the archive contains no
   `header*.xml`, `footer*.xml` or `word/media/` entries.
2. **Every template produces identical words.** Wrapping differs with font and
   size, so the test compares word sequences rather than layout. Three
   templates producing the same words is the property that matters: a template
   cannot change what is said.
3. **A blocked claim never reaches either file.** The draft under test has
   Kubernetes in `skills` and in a bullet, and it traces to nothing in the CV.
   Both formats are read back and asserted clean.

---

## Where the export guarantee actually lives

`app/api/export/[id]/route.ts` accepts a tailoring id, a format and a template
id. **Nothing else.**

It does not accept a document, a list of skills, or an "include" array. The
document is rebuilt server-side from the stored integrity report and the stored
approvals, by the same `assembleResumeDocument` that produced the on-screen
preview. So a caller who controls every parameter still cannot put a blocked
claim into a file — there is no parameter that reaches the content.

This is also why the preview and the download cannot drift apart. They are the
same function.

---

## Deliberate choices worth challenging

1. **DOCX headings are bold paragraphs, not `HeadingLevel.HEADING_1`.** Word's
   built-in heading styles carry a style id that some ATS parsers strip along
   with the text and others read as metadata rather than as a section label. A
   plain bold paragraph containing the literal words "Professional Summary" is
   read back correctly by every parser we ingest with. It looks identical to a
   human. **Challenge this if you have contrary evidence** — it is a judgement
   call about parser behaviour, not a fact I can prove from here.
2. **Bullets are literal `- ` text in both formats**, not Word numbering
   definitions and not drawn glyphs. Numbering definitions are a common cause of
   an ATS reading a list back as one unbroken paragraph.
3. **Base-14 PDF fonts, not embedded webfonts.** Real selectable text, no
   embedding, no licensing question. The cost is that text is limited to WinAnsi
   — see `export/text.ts`, which replaces smart quotes and dashes and drops
   anything outside Latin-1. Accented characters survive, because South African
   names need them.
4. **The greeting name comes from Google's JWT claims, not from the CV.** The CV
   name lives encrypted and is decrypted only when a document is assembled.
   Decrypting it to print "Hi Thabo" on a dashboard would move plaintext
   identity through the app on every page load, which is exactly the traffic the
   encryption exists to prevent. The Google name is also not stored — it is read
   from the session each request, so there is no second copy of anyone's name.
5. **Erasure moved forward from Phase 5.** Settings has a working delete. It
   removes every owned row first, then the auth user. Every table cascades from
   `auth.users`, so the auth deletion alone would suffice; the row deletion runs
   first so that if the privileged call fails, the CVs are already gone rather
   than orphaned.

---

## What to attack

### Export

1. **Open a real export in Word and in a PDF reader.** Then run it through a
   free ATS checker and see what it extracts.
2. **Try to get a blocked claim into a file.** Craft requests against
   `/api/export/[id]`. Change the template, change the format, add parameters.
   The route takes three inputs; confirm none of them reaches content.
3. **Export someone else's tailoring id.** Should 404, not 403 — RLS makes it
   indistinguishable from one that does not exist.
4. **A two-page CV.** Does a section heading ever end up orphaned at the foot of
   page one? There is a `Layout.heading` guard for this; verify it works.
5. **A CV with unusual characters.** Chinese, Arabic, emoji. They are dropped
   rather than replaced with question marks. Is dropping right?
6. **A very long single word**, like a 200-character URL. It should break rather
   than overflow the margin.
7. **Content-Disposition uses the CV name in the filename.** It is sanitised to
   `[^A-Za-z0-9]`. Try a name designed to break out of the header.

### Erasure

8. **Delete a test account and check Supabase.** Every table, plus
   `auth.users`. Anything left is a defect.
9. **What happens if the auth deletion fails after the rows are gone?** The
   error message says the CVs were deleted but the account was not closed.
   Confirm that is what actually happens and that a retry works.
10. **Is `reverifyForDestructiveAction` really hitting the Auth server?** It
    uses `getUser()` rather than `getClaims()` for exactly this reason.
11. Try to trigger `deleteAccount` without the confirmation field, and with the
    wrong word.

### The secret key

12. `grep -rn "SUPABASE_SECRET_KEY" app/ lib/ components/` — expect hits only in
    `env.ts` (the schema) and `admin.ts` (the one consumer). I ran this; run it
    yourself.
13. Confirm `admin.ts` is not imported by any Client Component. It is
    `server-only`, so it should be a build error, but check.

### Personalisation

14. **Confirm the greeting name never comes from the encrypted CV header.**
    `grep` for `decryptIdentityHeader` — it should appear only in
    `supabase-repo.ts`, called only by `getIdentity`, called only by the export
    route.
15. What does the greeting do for an account with no Google display name? It
    falls back to the email local part, title-cased. Is that acceptable, or
    creepy?

---

## Known gaps, stated up front

1. **Still no generated database types.** `supabase.from(...)` returns `any`.
   This is now the oldest open item and it has survived three phases. It needs
   the migration applied.
2. **No test opens an export in real Word or a real ATS.** The round trip uses
   `unpdf` and `mammoth`, which are good proxies and not the same thing. Real
   ATS behaviour varies by vendor and cannot be unit-tested from here.
3. **The DOCX heading decision is a judgement call**, see item 1 above.
4. **No retention purge yet.** The spec asks for a scheduled purge of inactive
   resume history with a documented period. That is still Phase 5.
5. **No security headers or CSP yet.** Phase 5.
6. **Carried forward, unchanged:** employer detection is heuristic and will have
   misses; prose-buried skill detection is vocabulary-bound; the name heuristic
   misses single-word, initialled and titled names.
