/**
 * The tailoring use case.
 *
 * This exists so that the ordering the guarantees depend on is expressed once,
 * in code, rather than being a rule that every future caller has to remember:
 *
 *     de-identify  ->  build inventory  ->  call the model  ->  validate
 *
 * The provider is reached only through this function, and this function has no
 * way to hand it anything but the de-identified content. "Never call Claude
 * before de-identification" therefore stops being a convention and becomes a
 * property of the call graph.
 *
 * It takes its provider as an argument, so the whole flow can be exercised in a
 * unit test against a fake — which is exactly how the §4 proof is written.
 */

import { deidentify } from './identity';
import { buildInventory } from './inventory';
import { reviewDraft } from './validator';
import type { AIProvider } from './ports';
import type {
  IdentityHeader,
  IntegrityReport,
  SkillInventory,
  TailoredDraft,
} from './types';

export interface TailoringInput {
  /** Raw text straight from the parser. Still fully identifying. */
  rawCvText: string;
  /** The advert as pasted by the user. Untrusted. */
  jobAdvert: string;
  provider: AIProvider;
}

export interface TailoringOutcome {
  /** Withheld from the model; held for server-side reattachment at export. */
  identity: IdentityHeader;
  /** Exactly what was sent to the provider. Retained so it can be audited. */
  sentToProvider: string;
  redactedIdCount: number;
  inventory: SkillInventory;
  draft: TailoredDraft;
  report: IntegrityReport;
}

export async function tailorCv(
  input: TailoringInput,
): Promise<TailoringOutcome> {
  const { identity, content, redactedIdCount } = deidentify(input.rawCvText);

  // The inventory is built from the de-identified content, not the raw text.
  // Anything stripped as identifying is not evidence of a skill, and building
  // from the raw text would let a name or an address become a "skill".
  const inventory = buildInventory(content);

  const draft = await input.provider.tailor({
    deidentifiedCv: content,
    jobAdvert: input.jobAdvert,
  });

  const report = reviewDraft(draft, inventory);

  return {
    identity,
    sentToProvider: content,
    redactedIdCount,
    inventory,
    draft,
    report,
  };
}
