/**
 * The tailoring use case.
 *
 * This exists so that the ordering the guarantee depends on is expressed once,
 * in code, rather than being a rule every future caller has to remember:
 *
 *     build inventory  ->  call the model  ->  validate every claim
 *
 * The inventory is built before the model is reached, from the applicant's own
 * CV, and the report is produced after. A claim the model writes is checked
 * against a record that existed before the model saw anything, which is what
 * stops the model from being both the author and the judge of its own work.
 *
 * It takes its provider as an argument, so the whole flow can be exercised in a
 * unit test against a fake. That is how the anti-fabrication proof is written.
 */

import { buildInventory } from './inventory';
import { reviewDraft } from './validator';
import type { AIProvider } from './ports';
import type { IntegrityReport, SkillInventory, TailoredDraft } from './types';

export interface TailoringInput {
  /** The applicant's CV, as uploaded. */
  cvText: string;
  /** The job advert. Untrusted: it is data, never instruction. */
  jobAdvert: string;
  provider: AIProvider;
}

export interface TailoringOutcome {
  /** Exactly what was sent to the provider. Retained so it can be audited. */
  sentToProvider: string;
  inventory: SkillInventory;
  draft: TailoredDraft;
  report: IntegrityReport;
}

export async function tailorCv(
  input: TailoringInput,
): Promise<TailoringOutcome> {
  // Built first, and from the CV rather than from the advert. An advert that
  // asks for Kubernetes must not be able to put Kubernetes into the record
  // that Kubernetes is later checked against.
  const inventory = buildInventory(input.cvText);

  const draft = await input.provider.tailor({
    cv: input.cvText,
    jobAdvert: input.jobAdvert,
  });

  const report = reviewDraft(draft, inventory);

  return {
    sentToProvider: input.cvText,
    inventory,
    draft,
    report,
  };
}
