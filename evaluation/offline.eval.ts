import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { UnsupportedFileError, cvParser } from '@/lib/infrastructure/parser';

import { listResumePdfs } from './dataset';
import { percent, printMeasurement, progress, saveMeasurement } from './report';

/**
 * The measurement that needs no network and costs nothing.
 *
 * The parser is pure and local: it makes no request, opens no socket and
 * reaches no provider. So 500 published resumes are read, measured and
 * discarded on this machine, and none of that data leaves it. That property is
 * why this measurement can be run over real people's documents at all.
 *
 * The sample size is an environment variable so the harness can be run small
 * while it is being developed and in full when the number is being recorded.
 */

const PDF_SAMPLE = Number(process.env.CANDID_EVAL_PDFS ?? 500);

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
// What used to be here
// ---------------------------------------------------------------------------
//
// Measurements 2 and 3 measured the de-identification layer: how completely an
// injected identity header was removed, and how often the identity-number
// detector fired on documents containing none. Both are gone, because the
// layer they measured is gone.
//
// Their results are not deleted from the record. They were real measurements
// on 2 483 published resumes and they are reported in the project
// documentation as part of the history of the build, alongside the reason the
// feature was dropped.
//
// The parser measurement above survives because the parser does, and the
// fabrication measurement lives in tailoring.eval.ts because it needs the
// live model.
