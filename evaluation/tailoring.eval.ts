import { describe, expect, it } from 'vitest';

import { assembleResumeDocument } from '@/lib/domain/resume-document';
import { tailorCv } from '@/lib/domain/tailoring';
import { claudeProvider } from '@/lib/infrastructure/claude-provider';
import type { ApprovedClaims } from '@/lib/domain/types';

import { loadJobAdverts, loadResumeText } from './dataset';
import { injectIdentity, leakedValues, makeIdentity } from './identifiers';
import { percent, printMeasurement, progress, saveMeasurement } from './report';

/**
 * Measurement 4 — the guarantees, against a real model on real documents.
 *
 * The unit suite already proves the validator holds against a draft written to
 * be hostile. That is a proof about the rule. It is not a measurement of what
 * the model actually does when handed a stranger's resume and an unrelated job
 * advert, which is the situation every real user is in.
 *
 * This run costs money and takes minutes, so it is a separate file and a
 * separate command. The sample is small by default for the same reason.
 *
 * Requires ANTHROPIC_API_KEY. Skips loudly without one, because a silent skip
 * would report success while the half that matters never ran.
 */

const SAMPLE = Number(process.env.CANDID_EVAL_TAILORINGS ?? 25);

/** Courtesy gap between calls, so a burst does not trip the provider's limiter. */
const PAUSE_MS = Number(process.env.CANDID_EVAL_PAUSE_MS ?? 1_000);

const NOTHING_APPROVED: ApprovedClaims = new Set<string>();

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe('tailoring against the live model', () => {
  it.skipIf(!process.env.ANTHROPIC_API_KEY)(
    'never fabricates and never leaks, across real resumes and real adverts',
    async () => {
      const resumes = await loadResumeText(SAMPLE);
      const adverts = await loadJobAdverts(SAMPLE);

      expect(resumes.length).toBeGreaterThan(0);
      expect(adverts.length).toBeGreaterThan(0);

      const pairs = Math.min(resumes.length, adverts.length);

      let completed = 0;
      let accepted = 0;
      let borderline = 0;
      let blocked = 0;

      let documentsClean = 0;
      let payloadsClean = 0;

      const latencies: number[] = [];
      const fabricationsReachingDocument: string[] = [];
      const payloadLeaks: string[] = [];
      const providerErrors: string[] = [];

      for (let index = 0; index < pairs; index += 1) {
        const identity = makeIdentity(index);
        const rawCvText = injectIdentity(resumes[index].text, identity);
        const advert = adverts[index];

        const startedAt = Date.now();

        try {
          const outcome = await tailorCv({
            rawCvText,
            jobAdvert: advert.text,
            provider: claudeProvider,
          });

          latencies.push(Date.now() - startedAt);
          completed += 1;

          accepted += outcome.report.accepted.length;
          borderline += outcome.report.borderline.length;
          blocked += outcome.report.blocked.length;

          // Guarantee 1, measured on the exact bytes that crossed the network.
          const leaked = leakedValues(identity, outcome.sentToProvider);
          if (leaked.length === 0) {
            payloadsClean += 1;
          } else {
            payloadLeaks.push(`${resumes[index].id}: ${leaked.join(', ')}`);
          }

          // Guarantee 2. Build the document the user would download, with
          // nothing approved, and look for anything the validator refused.
          const { document } = assembleResumeDocument({
            identity: outcome.identity,
            draft: outcome.draft,
            report: outcome.report,
            approved: NOTHING_APPROVED,
          });

          const rendered = JSON.stringify(document);
          const survivors = outcome.report.blocked
            .map((claim) => claim.claim.text)
            .filter((text) => text.trim().length > 2 && rendered.includes(text));

          if (survivors.length === 0) {
            documentsClean += 1;
          } else {
            fabricationsReachingDocument.push(
              `${resumes[index].id}: ${survivors.join(' | ')}`,
            );
          }
        } catch (error) {
          providerErrors.push(
            error instanceof Error ? error.message : String(error),
          );
        }

        progress('tailored', index + 1, pairs);
        if (index < pairs - 1) await wait(PAUSE_MS);
      }

      const sorted = [...latencies].sort((a, b) => a - b);
      const p95 = sorted.length
        ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]
        : 0;
      const mean = sorted.length
        ? Math.round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length)
        : 0;

      const measurement = {
        key: 'tailoring',
        title: 'Measurement 4 — fabrication and leakage on live output',
        question:
          'Across real resumes and unrelated adverts, does any refused claim reach a document, and does any identifier reach the model?',
        figures: {
          'Pairs attempted': pairs,
          'Completed': completed,
          'Provider errors': providerErrors.length,
          'Claims accepted': accepted,
          'Claims borderline': borderline,
          'Claims blocked': blocked,
          'Documents free of blocked claims': documentsClean,
          'Fabrication rate': percent(
            fabricationsReachingDocument.length,
            Math.max(completed, 1),
          ),
          'Payloads free of identifiers': payloadsClean,
          'Identity leak rate': percent(payloadLeaks.length, Math.max(completed, 1)),
          'Mean latency (ms)': mean,
          'p95 latency (ms)': p95,
        },
        detail: {
          fabricationsReachingDocument,
          payloadLeaks,
          providerErrors: providerErrors.slice(0, 10),
        },
      };

      printMeasurement(measurement);
      await saveMeasurement(measurement);

      // These two are asserted rather than merely reported. They are the
      // product's two promises, and a single failure of either is a defect, not
      // a statistic to average away.
      expect(fabricationsReachingDocument).toEqual([]);
      expect(payloadLeaks).toEqual([]);
    },
  );
});
