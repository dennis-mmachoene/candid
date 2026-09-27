import { describe, expect, it } from 'vitest';

import {
  ATS_SECTION_HEADINGS,
  assembleResumeDocument,
} from '@/lib/domain/resume-document';
import { tailorCv } from '@/lib/domain/tailoring';
import {
  AIProviderError,
  claudeProvider,
} from '@/lib/infrastructure/claude-provider';
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
      const blockedClaimEchoes: string[] = [];
      let documentsWithEchoes = 0;

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

          /*
           * Two different failures wear the same disguise, so they are counted
           * apart.
           *
           * A CONTAINER LEAK is the guarantee breaking. The claim's own
           * container survived into the document: a refused skill printed in
           * the Skills list. That is a defect and it fails the run.
           *
           * An ECHO is the same words turning up somewhere else. The container
           * was dropped exactly as designed, but the phrase also occurs inside
           * a block that was validated on its own and accepted. Nothing was
           * fabricated. The problem is narrower and still real: the integrity
           * report told the user that phrase had been removed, and it is on
           * the page. That is a reporting-honesty defect, not a fabrication,
           * and it needs its own fix.
           *
           * The first version of this check searched the whole document for
           * the text of every blocked claim and called every hit a
           * fabrication. That conflated the two and produced a frightening
           * number that could not be acted on. Recording the claim's source
           * and the section it surfaced in is what separates them.
           */
          /*
           * Matching, third attempt, and the reason for each correction is
           * worth keeping.
           *
           * Attempt one searched the whole document for the text of every
           * blocked claim. It reported 18% fabrication. Attempt two split
           * container leaks from echoes and reported 5%. Both numbers were
           * inflated by the same thing: a short refused phrase matching inside
           * a longer phrase that was accepted on its own merits. "Management"
           * was reported as a leak because the Skills list contained something
           * like "Business Management".
           *
           * Two rules fix it.
           *
           * For the Skills list, compare whole items. The list is built by
           * joining accepted skills with ", ", so splitting it back gives the
           * exact set that was printed, and an exact match is decidable.
           *
           * For prose, ignore a refused phrase that is contained inside
           * something that WAS accepted. What the reader sees in that case is
           * the accepted item, not the refused one.
           */
          const acceptedTexts = outcome.report.accepted.map((claim) =>
            claim.claim.text.trim().toLowerCase(),
          );

          const swallowedByAccepted = (text: string): boolean => {
            const needle = text.toLowerCase();
            return acceptedTexts.some(
              (accepted) => accepted !== needle && accepted.includes(needle),
            );
          };

          const skillsSection = document.sections.find(
            (section) => section.heading === ATS_SECTION_HEADINGS.skills,
          );
          const printedSkills = new Set(
            (skillsSection?.blocks ?? [])
              .flatMap((block) => (block.kind === 'paragraph' ? block.text.split(', ') : []))
              .map((item) => item.trim().toLowerCase()),
          );

          const containerLeaks: { text: string; section: string }[] = [];
          const echoes: { text: string; source: string; section: string }[] = [];

          for (const claim of outcome.report.blocked) {
            const text = claim.claim.text.trim();
            if (text.length <= 3) continue;

            // The guarantee: a refused skill must not be printed as a skill.
            if (
              claim.claim.source === 'skill' &&
              printedSkills.has(text.toLowerCase())
            ) {
              containerLeaks.push({
                text,
                section: ATS_SECTION_HEADINGS.skills,
              });
              continue;
            }

            if (swallowedByAccepted(text)) continue;

            for (const section of document.sections) {
              if (section.heading === ATS_SECTION_HEADINGS.skills) continue;
              if (JSON.stringify(section.blocks).includes(text)) {
                echoes.push({
                  text,
                  source: claim.claim.source,
                  section: section.heading,
                });
              }
            }
          }

          if (containerLeaks.length === 0) {
            documentsClean += 1;
          } else {
            fabricationsReachingDocument.push(
              `${resumes[index].id}: ${containerLeaks
                .map((hit) => `${hit.text} printed in ${hit.section}`)
                .join(' | ')}`,
            );
          }

          if (echoes.length > 0) {
            documentsWithEchoes += 1;
            for (const hit of echoes.slice(0, 3)) {
              blockedClaimEchoes.push(
                `${resumes[index].id}: "${hit.text}" refused as a ${hit.source}, still readable in ${hit.section}`,
              );
            }
          }
        } catch (error) {
          /*
           * Record why, not just that.
           *
           * The provider's user-facing message is the same sentence for every
           * kind of failure, by design. That turned 14 failures into 14
           * identical lines and told us nothing. The original error is now
           * attached to AIProviderError, and this corpus is public CC0 data
           * rather than a real person's CV, so it is safe to write down here.
           */
          const original =
            error instanceof AIProviderError ? error.original : undefined;

          const detail =
            original instanceof Error
              ? `${original.name}: ${original.message.slice(0, 300)}`
              : original === undefined
                ? '(no original error attached)'
                : String(original).slice(0, 300);

          providerErrors.push(
            `${error instanceof Error ? error.message : String(error)} || ${detail}`,
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
          'Documents with a blocked-claim echo': documentsWithEchoes,
          'Echo rate': percent(documentsWithEchoes, Math.max(completed, 1)),
          'Payloads free of identifiers': payloadsClean,
          'Identity leak rate': percent(payloadLeaks.length, Math.max(completed, 1)),
          'Mean latency (ms)': mean,
          'p95 latency (ms)': p95,
        },
        detail: {
          fabricationsReachingDocument,
          blockedClaimEchoes: blockedClaimEchoes.slice(0, 25),
          payloadLeaks,
          providerErrors: providerErrors.slice(0, 10),
        },
      };

      printMeasurement(measurement);
      await saveMeasurement(measurement);

      /*
       * Assert that the measurement happened, before asserting what it found.
       *
       * This check exists because its absence produced a false result. On a run
       * where every request was rejected at the provider, `completed` was zero,
       * both sets below were trivially empty, and the suite reported a pass.
       * The figures printed above said 0.00% fabrication and 0.00% leakage,
       * which is exactly what a perfect run looks like.
       *
       * A measurement that did not happen must never be indistinguishable from
       * one that succeeded. So the completed count is now a precondition for
       * reading the rates, not merely a line in the report.
       *
       * The threshold is four fifths rather than all of them. A transient rate
       * limit or an overloaded response is a normal fact of calling a hosted
       * model and should not fail a run. Losing a fifth of the sample is
       * different: at that point the rates are computed over too little to be
       * worth quoting.
       */
      const required = Math.ceil(pairs * 0.8);
      expect(
        completed,
        `Only ${completed} of ${pairs} pairs completed, so the rates above are ` +
          `not meaningful and nothing below has been measured. ` +
          `First provider errors: ${providerErrors.slice(0, 3).join(' | ')}`,
      ).toBeGreaterThanOrEqual(required);

      // These two are asserted rather than merely reported. They are the
      // product's two promises, and a single failure of either is a defect, not
      // a statistic to average away.
      expect(fabricationsReachingDocument).toEqual([]);
      expect(payloadLeaks).toEqual([]);
    },
  );
});
