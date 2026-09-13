import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import {
  ID_REDACTION,
  deidentify,
  redactSaIdNumbers,
} from '@/lib/domain/identity';
import { UnsupportedFileError, cvParser } from '@/lib/infrastructure/parser';

import { listResumePdfs, loadResumeText } from './dataset';
import {
  findEmails,
  findPhones,
  findThirteenDigitRuns,
  injectIdentity,
  leakedValues,
  looksLikeSaId,
  makeIdentity,
} from './identifiers';
import { percent, printMeasurement, progress, saveMeasurement } from './report';

/**
 * The three measurements that need no network and cost nothing.
 *
 * Every one of them runs entirely on this machine. The de-identification code
 * is pure: it makes no request, opens no socket and reaches no provider. So the
 * published resumes are read, measured and discarded locally, and none of that
 * data leaves the laptop. That property is worth stating because it is the
 * reason this evaluation can be run over thousands of real people's documents
 * at all.
 *
 * Sample sizes are environment variables so the harness can be run small while
 * it is being developed and in full when the numbers are being recorded.
 */

const PDF_SAMPLE = Number(process.env.CANDID_EVAL_PDFS ?? 500);
const TEXT_SAMPLE = Number(process.env.CANDID_EVAL_RESUMES ?? 2484);
const INJECTION_SAMPLE = Number(process.env.CANDID_EVAL_INJECTIONS ?? 500);

// ---------------------------------------------------------------------------
// Measurement 1 — the parser, against real files
// ---------------------------------------------------------------------------

describe('parser', () => {
  it('extracts readable text from real resume PDFs', async () => {
    const files = await listResumePdfs(PDF_SAMPLE);
    expect(files.length).toBeGreaterThan(0);

    let succeeded = 0;
    const failures: Record<string, number> = {};
    const unexpected: { file: string; error: string }[] = [];
    let totalCharacters = 0;

    for (const [index, pdf] of files.entries()) {
      const bytes = new Uint8Array(await readFile(pdf.file));

      try {
        const parsed = await cvParser.parse(bytes);
        succeeded += 1;
        totalCharacters += parsed.text.length;
      } catch (error) {
        if (error instanceof UnsupportedFileError) {
          // Refusals are a designed outcome, not a crash. Group them by the
          // message the user would actually see.
          const reason = error.message;
          failures[reason] = (failures[reason] ?? 0) + 1;
        } else {
          // Anything else is the parser falling over, which is a defect.
          unexpected.push({
            file: pdf.file,
            error: error instanceof Error ? error.name : String(error),
          });
        }
      }

      progress('parsed', index + 1, files.length);
    }

    const measurement = {
      key: 'parser',
      title: 'Measurement 1 — parser success rate',
      question:
        'Of real resume PDFs drawn from 24 professions, how many yield usable text?',
      figures: {
        'PDFs attempted': files.length,
        'Parsed successfully': succeeded,
        'Success rate': percent(succeeded, files.length),
        'Refused with a reason': files.length - succeeded - unexpected.length,
        'Unexpected failures': unexpected.length,
        'Mean characters extracted':
          succeeded === 0 ? 0 : Math.round(totalCharacters / succeeded),
      },
      detail: { refusalsByReason: failures, unexpected: unexpected.slice(0, 20) },
    };

    printMeasurement(measurement);
    await saveMeasurement(measurement);

    // A refusal is a decision. A crash is a bug. Only the second fails the run.
    expect(unexpected).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Measurement 2 — de-identification
// ---------------------------------------------------------------------------

describe('de-identification', () => {
  /**
   * Part A. The published resumes were anonymised before release, but not
   * completely: a small number of addresses and telephone numbers survived. Those
   * leftovers are real identifiers in real documents, so they are worth measuring
   * on their own terms before anything synthetic is introduced.
   */
  it('removes the identifiers that survived publication', async () => {
    const resumes = await loadResumeText(TEXT_SAMPLE);
    expect(resumes.length).toBeGreaterThan(0);

    let emailsBefore = 0;
    let emailsAfter = 0;
    let phonesBefore = 0;
    let phonesAfter = 0;
    const survivingExamples: string[] = [];

    for (const [index, resume] of resumes.entries()) {
      const before = resume.text;
      const { content } = deidentify(before);

      emailsBefore += findEmails(before).length;
      phonesBefore += findPhones(before).length;

      const emailsLeft = findEmails(content);
      const phonesLeft = findPhones(content);

      emailsAfter += emailsLeft.length;
      phonesAfter += phonesLeft.length;

      // Label them. Knowing that forty numbers survived is useful; knowing
      // which shapes survived is what tells you whether a fix is cheap.
      for (const value of emailsLeft.slice(0, 2)) {
        if (survivingExamples.length < 30) {
          survivingExamples.push(`email: ${value}`);
        }
      }
      for (const value of phonesLeft.slice(0, 2)) {
        if (survivingExamples.length < 30) {
          survivingExamples.push(`phone: ${value.trim()}`);
        }
      }

      progress('de-identified', index + 1, resumes.length);
    }

    const totalBefore = emailsBefore + phonesBefore;
    const totalAfter = emailsAfter + phonesAfter;

    const measurement = {
      key: 'deidentification-natural',
      title: 'Measurement 2a — residual identifiers in published data',
      question:
        'Of the identifiers left in the public dataset, how many survive de-identification?',
      figures: {
        'Resumes processed': resumes.length,
        'Email addresses before': emailsBefore,
        'Email addresses after': emailsAfter,
        'Telephone numbers before': phonesBefore,
        'Telephone numbers after': phonesAfter,
        'Identifiers removed': totalBefore - totalAfter,
        'Removal rate': percent(totalBefore - totalAfter, totalBefore),
      },
      detail: { survivingExamples },
    };

    printMeasurement(measurement);
    await saveMeasurement(measurement);
  });

  /**
   * Part B. The headline number.
   *
   * The published resumes have no header block, because one was removed before
   * release. So a known header is written back on: a South African name, an
   * email address, a mobile number, a street address and a valid identity
   * number, all generated and all recorded.
   *
   * That gives exact ground truth. Hand-labelling identifiers in someone else's
   * documents would give an estimate and an argument about the edge cases. This
   * gives a set of strings that must not appear in the output, and a leak is
   * then a fact rather than a judgement.
   */
  it('strips an injected identity header completely', async () => {
    const resumes = await loadResumeText(INJECTION_SAMPLE);
    expect(resumes.length).toBeGreaterThan(0);

    let clean = 0;
    let idsRedacted = 0;
    const leaks: { id: string; leaked: string[] }[] = [];

    for (const [index, resume] of resumes.entries()) {
      const identity = makeIdentity(index);
      const withHeader = injectIdentity(resume.text, identity);

      const { content, redactedIdCount } = deidentify(withHeader);
      const leaked = leakedValues(identity, content);

      if (redactedIdCount > 0) idsRedacted += 1;

      if (leaked.length === 0) {
        clean += 1;
      } else if (leaks.length < 25) {
        leaks.push({ id: resume.id, leaked });
      }

      progress('injected', index + 1, resumes.length);
    }

    const measurement = {
      key: 'deidentification-injected',
      title: 'Measurement 2b — de-identification against known ground truth',
      question:
        'With a known identity header injected into each resume, how much of it survives?',
      figures: {
        'Resumes processed': resumes.length,
        'Fully de-identified': clean,
        'Leak-free rate': percent(clean, resumes.length),
        'Resumes with any leak': resumes.length - clean,
        'Identity numbers redacted': idsRedacted,
        'ID redaction rate': percent(idsRedacted, resumes.length),
      },
      detail: { leaks },
    };

    printMeasurement(measurement);
    await saveMeasurement(measurement);

    // Not asserted as zero. The point of a measurement is to find out, and a
    // harness that fails on the first surprise tells you nothing about the rest
    // of the sample. Read the number, then decide whether it is acceptable.
    expect(clean).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Measurement 3 — over-redaction
// ---------------------------------------------------------------------------

describe('identity-number detection', () => {
  /**
   * The question the Phase 1 audit raised and never answered.
   *
   * A South African identity number is thirteen digits, so any thirteen-digit
   * run is a candidate. Candid narrows that with a Luhn check and a date
   * plausibility check, and the audit estimated that roughly three percent of
   * random runs would still pass both. Three percent of what, over how many real
   * documents, was left open.
   *
   * This is an American dataset. It contains no South African identity numbers,
   * so every redaction it triggers is over-redaction: a reference number, an
   * account number or an employee number destroyed for no reason. That makes the
   * false-positive rate directly measurable, which it would not be on data where
   * genuine identity numbers were mixed in.
   *
   * The caveat is stated rather than hidden: a published American resume could in
   * principle carry a South African identity number, so the figure is an upper
   * bound on over-redaction rather than a proof of it.
   */
  it('measures the false-positive rate on data with no South African IDs', async () => {
    const resumes = await loadResumeText(TEXT_SAMPLE);

    let runsFound = 0;
    let runsRedacted = 0;
    let resumesAffected = 0;
    const examples: { id: string; value: string; category: string }[] = [];
    let disagreements = 0;

    for (const [index, resume] of resumes.entries()) {
      const runs = findThirteenDigitRuns(resume.text);
      runsFound += runs.length;

      const { count } = redactSaIdNumbers(resume.text);
      runsRedacted += count;
      if (count > 0) resumesAffected += 1;

      // Cross-check the domain implementation against the independent one in
      // evaluation/identifiers.ts. A disagreement means one of the two is wrong
      // and is worth knowing about on its own.
      const independent = runs.filter(looksLikeSaId);
      if (independent.length !== count) disagreements += 1;

      for (const value of independent) {
        if (examples.length < 25) {
          examples.push({ id: resume.id, value, category: resume.category });
        }
      }

      progress('scanned', index + 1, resumes.length);
    }

    const measurement = {
      key: 'id-false-positives',
      title: 'Measurement 3 — identity-number over-redaction',
      question:
        'On data containing no South African IDs, how often does the detector fire anyway?',
      figures: {
        'Resumes scanned': resumes.length,
        'Thirteen-digit runs found': runsFound,
        'Runs redacted as ID numbers': runsRedacted,
        'False-positive rate per run': percent(runsRedacted, runsFound),
        'Resumes with a false positive': resumesAffected,
        'False-positive rate per resume': percent(resumesAffected, resumes.length),
        'Domain vs independent disagreements': disagreements,
        'Redaction marker': ID_REDACTION,
      },
      detail: { examples },
    };

    printMeasurement(measurement);
    await saveMeasurement(measurement);

    // The two implementations must agree. If they do not, the reported rate is
    // not trustworthy and that is a defect in one of them.
    expect(disagreements).toBe(0);
  });
});
