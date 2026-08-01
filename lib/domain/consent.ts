/**
 * POPIA consent.
 *
 * Section 18 of the Protection of Personal Information Act requires that a data
 * subject be told who is processing their information and for what. Naming the
 * operators is not a formality here — the whole claim Candid makes is that the
 * AI provider never receives anything identifying, and this list is where that
 * claim is stated to the user in writing.
 *
 * `receivesIdentifyingData: false` against Anthropic is the load-bearing entry.
 * If a change to this codebase ever makes it untrue, this file must change too,
 * the policy version must be bumped, and every user must re-consent.
 */

import type { ConsentRecord, Operator } from './types';

/**
 * Bump this whenever the operator list, the purposes, or the data flows change.
 * Consent recorded against an older version no longer counts.
 */
export const POLICY_VERSION = '2026-08-01';

export const OPERATORS: readonly Operator[] = [
  {
    name: 'Supabase',
    purpose:
      'Stores your account, your uploaded CV and your tailored versions. Your name, email address and phone number are encrypted before they are stored.',
    jurisdiction:
      'European Union (must match the region selected for the Supabase project)',
    receivesIdentifyingData: true,
  },
  {
    name: 'Anthropic (Claude)',
    purpose:
      'Rewrites the wording of your experience to match a job advert. It receives only the experience, skills and education portion of your CV.',
    jurisdiction: 'United States',
    receivesIdentifyingData: false,
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
 * Plain-language statements shown on the consent gate. Written to be read, not
 * to be scrolled past.
 */
export const CONSENT_STATEMENTS: readonly string[] = [
  'Your name, email address and phone number are removed from your CV before any of it is sent to Claude, and added back only on your own device-bound download.',
  'If your CV contains a South African ID number it is redacted and discarded. Candid has no field to store one.',
  'Candid will never add a skill, employer or date that your CV does not support, even if the job advert asks for it.',
  'You can delete your account and everything in it at any time, and the deletion is immediate.',
];

/** The operators that actually receive identifying information. */
export function operatorsReceivingIdentifyingData(): readonly Operator[] {
  return OPERATORS.filter((operator) => operator.receivesIdentifyingData);
}

/** True when a stored consent no longer covers the current policy. */
export function requiresReconsent(
  record: Pick<ConsentRecord, 'policyVersion'> | null,
): boolean {
  return record === null || record.policyVersion !== POLICY_VERSION;
}

/** Build the record to persist when a user accepts. */
export function createConsentRecord(acceptedAt: Date): ConsentRecord {
  return { policyVersion: POLICY_VERSION, acceptedAt, operators: OPERATORS };
}
