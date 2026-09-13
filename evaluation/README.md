# Evaluation

Candid's test suite proves the two guarantees hold against drafts written to
break them. That is a proof about the rules.

This is the other half: what the rules do when pointed at thousands of real
documents nobody wrote for the purpose. It produces numbers, not pass or fail.

The two are kept apart on purpose. `npm test` gates the build and must stay
fast, offline and deterministic. Evaluation reads gigabytes off disk and, in one
case, calls a paid API. A failed evaluation says nothing about whether the code
is correct, so it must never block a merge.

---

## The datasets

Both are public domain, both from Kaggle, both kept outside the repository.

| Dataset | Ref | Licence |
|---|---|---|
| Resume Dataset | `snehaanbhawal/resume-dataset` | CC0 |
| Job Description Dataset | `ravindrasinghrana/job-description-dataset` | CC0 |

The resume set holds 2484 PDFs across 24 professions, plus the same resumes as
plain text in `Resume/Resume.csv`.

Extract both beside the repository:

```
Candid Folder/
  candid/        <- this repository
  Datasets/
    Resume Dataset (snehaanbhawal)/
    Job Description Dataset (ravindrasinghrana)/
```

Set `CANDID_DATASET_DIR` if yours live somewhere else.

Nothing here is committed. The data is large and it is not ours to
redistribute.

---

## Running it

```bash
npm run evaluate       # measurements 1, 2 and 3 — offline, free
npm run evaluate:ai    # measurement 4 — calls the model, costs money
```

Results are written to `evaluation/results/` as JSON and Markdown, so a figure
quoted in the documentation can be traced back to the run that produced it.

Sample sizes are environment variables:

| Variable | Default | Controls |
|---|---|---|
| `CANDID_EVAL_PDFS` | 500 | PDFs parsed in measurement 1 |
| `CANDID_EVAL_RESUMES` | 2484 | Resumes scanned in 2a and 3 |
| `CANDID_EVAL_INJECTIONS` | 500 | Resumes used in 2b |
| `CANDID_EVAL_TAILORINGS` | 25 | Model calls in measurement 4 |

Full run over every PDF:

```bash
CANDID_EVAL_PDFS=2484 npm run evaluate
```

---

## What each measurement asks

**1. Parser success rate.** Of real resume PDFs, how many yield usable text?
Only real files can test magic-byte detection. A column of text is not a file.

**2a. Residual identifiers.** The published resumes were anonymised before
release, but not completely. A few addresses and telephone numbers survived.
How many of those does de-identification remove?

**2b. Known ground truth.** A generated South African identity header is written
back onto each resume: name, email, mobile number, street address and a valid
identity number. Every one of those strings is recorded, so a leak is a fact
rather than a judgement. This is the headline number.

**3. Over-redaction.** An identity number is thirteen digits, so any
thirteen-digit run is a candidate. Candid narrows that with a Luhn check and a
date check. The Phase 1 audit estimated roughly three percent of random runs
would still pass both, and left the real figure open.

This dataset is American and contains no South African identity numbers, so
every redaction it triggers destroyed something else: a reference number, an
account number, an employee number. That makes the false-positive rate
measurable.

The caveat is stated rather than hidden. A published American resume could in
principle carry a South African identity number, so the figure is an upper bound
on over-redaction rather than a proof of it.

**4. Fabrication and leakage.** Real resumes, unrelated adverts, the live model.
Does any refused claim reach a downloadable document, and does any identifier
reach the provider?

---

## Two things that make the numbers worth something

**The checking code is independent.** `evaluation/identifiers.ts` implements
Luhn, the email pattern and the telephone patterns from scratch. It does not
import them from `lib/domain`.

If the harness verified de-identification using the same expressions that
performed it, it would only prove that a function agrees with itself. A pattern
that misses a telephone format would miss it twice, once when redacting and once
when checking, and the run would report a clean sweep.

Measurement 3 exploits this directly: it runs both implementations and fails if
they disagree.

**Nothing leaves the machine except in measurement 4.** De-identification is
pure code. It opens no socket and reaches no provider. So thousands of real
people's resumes are read, measured and discarded locally.

Measurement 4 is the exception, and by the time it calls the model the text has
already been stripped. That ordering is enforced by the call graph, not by this
harness remembering to do it.
