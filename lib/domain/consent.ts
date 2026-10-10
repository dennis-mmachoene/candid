/**
 * The policy declaration.
 *
 * One place that names what Candid promises, who processes the data, and which
 * version of that statement is current. The privacy page, the terms page and
 * the footer are all generated from these constants, so there is no second
 * prose copy to quietly fall out of date.
 *
 * On `receivesIdentifyingData`: it is now true for every operator, and that is
 * the honest answer. An earlier version of Candid stripped the name, contact
 * details and any ID number out of a CV before sending it to the AI provider.
 * That de-identification is gone. The CV is sent as it was uploaded, because
 * the rewriting is better when the model can see the whole document, and
 * because a claim that the provider sees nothing identifying is a claim that
 * has to be true on every code path or it should not be made at all.
 *
 * The field is kept rather than deleted because consent records already stored
 * carry it, and a stored record is meant to show what the user was told at the
 * time, not what the code says today.
 */

import type { ConsentRecord, Operator } from './types';

/**
 * Bump this whenever the operator list, the purposes, or the data flows change.
 * A record stored against an older version describes older terms.
 */
export const POLICY_VERSION = '2026-10-10';

/**
 * How long a CV survives without being used.
 *
 * Twelve months rather than three. Job searches are long, people come back to a
 * CV they wrote last year, and a tool that silently deleted their work after a
 * quarter would be worse than useless to the people this is built for.
 *
 * This number appears in three places on purpose — here, on the privacy page,
 * and in the migration that enforces it. A retention period nobody is told
 * about is not a policy, it is a habit.
 */
export const RETENTION_MONTHS = 12;

export const OPERATORS: readonly Operator[] = [
  {
    name: 'Supabase',
    purpose:
      'Stores your account, your profile, the CV you upload, every tailored version, and the applications you send.',
    jurisdiction:
      'European Union (must match the region selected for the Supabase project)',
    receivesIdentifyingData: true,
  },
  {
    name: 'Anthropic (Claude)',
    purpose:
      'Rewrites the wording of your experience to match a job advert. It receives the text of your CV and the text of the advert, and nothing else about you.',
    jurisdiction: 'United States',
    receivesIdentifyingData: true,
  },
  {
    name: 'Google',
    purpose:
      'Signs you in. Candid never sees or stores a password — Google confirms your identity and returns only your email address.',
    jurisdiction: 'United States',
    receivesIdentifyingData: true,
  },
  {
    name: 'Vercel',
    purpose:
      'Hosts the application and serves it to your browser. It processes connection metadata such as your IP address.',
    jurisdiction: 'United States, with global edge locations',
    receivesIdentifyingData: true,
  },
];

/**
 * The promises, in plain language. Written to be read, not to be scrolled past.
 *
 * Each one is a statement the code has to keep true. The first is enforced by
 * the specification chain in `lib/domain/provenance.ts`, the third by the
 * Row-Level Security policies in migration 0005, and the last two by the
 * deletion action and the retention purge.
 */
export const CONSENT_STATEMENTS: readonly string[] = [
  'Candid will never add a skill, employer, qualification or date that your CV does not support, even when the job advert asks for it.',
  'Your CV is sent to Anthropic to be reworded, and the result is checked against your CV before you are shown it. Nothing is sent to an employer until you press send.',
  'An employer can see your CV only for a role you applied to, and only the version you submitted to that role.',
  'You can delete your account and everything in it at any time, and the deletion is immediate.',
  `If you do not use a stored CV for ${RETENTION_MONTHS} months, it is deleted automatically along with everything tailored from it.`,
];

/** The operators that receive identifying information. Currently all of them. */
export function operatorsReceivingIdentifyingData(): readonly Operator[] {
  return OPERATORS.filter((operator) => operator.receivesIdentifyingData);
}

/** True when a stored record no longer covers the current policy version. */
export function requiresReconsent(
  record: Pick<ConsentRecord, 'policyVersion'> | null,
): boolean {
  return record === null || record.policyVersion !== POLICY_VERSION;
}

/** Build the record to persist when a user accepts. */
export function createConsentRecord(acceptedAt: Date): ConsentRecord {
  return { policyVersion: POLICY_VERSION, acceptedAt, operators: OPERATORS };
}
