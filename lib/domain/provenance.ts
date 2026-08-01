/**
 * Employers and dates.
 *
 * The spec says never invent skills, employers **or dates**, and until now only
 * skills were checked. The independent Phase 1 audit flagged this as the gap to
 * prioritise, and it was right: for a CV tool, an invented employer or a
 * stretched employment date is at least as damaging as an invented skill. It is
 * the kind of thing that gets an offer withdrawn after a background check.
 *
 * The rule here is simpler and stricter than the one for skills, because it can
 * afford to be. A skill can be a fair inference from stated experience — "led a
 * team of five" really does evidence team leadership. An employer cannot be
 * inferred from anything. Either the CV names it or the model made it up. So
 * there is no borderline verdict on this path: named in the source, or blocked.
 *
 * Dates work the same way. If the CV says 2020 and the draft says 2018, that is
 * not a rewording.
 */

import {
  PROSE_MATCHABLE_VOCABULARY,
  SKILL_ALIASES,
  canonicalise,
} from './inventory';

/** A proper noun or date found in generated text, awaiting a provenance check. */
export interface ProvenanceMention {
  text: string;
  kind: 'employer' | 'date';
}

/**
 * Capitalised words that routinely open a sentence or describe a place or
 * language rather than an employer. Without this list, a bullet beginning
 * "South African payment rails..." reads as an organisation.
 *
 * Only used to suppress *reporting*; it never causes anything to be accepted
 * that would otherwise be blocked.
 */
const NOT_ORGANISATIONS = new Set([
  'south african',
  'south africa',
  'north west',
  'western cape',
  'eastern cape',
  'northern cape',
  'kwazulu natal',
  'new zealand',
  'united kingdom',
  'united states',
  'english',
  'afrikaans',
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]);

/**
 * Acronyms that are technologies or qualifications rather than employers.
 * Skills already have their own path through the validator; flagging them here
 * as well would double-report them.
 */
const NOT_ACRONYM_ORGANISATIONS = new Set([
  'API',
  'APIS',
  'SQL',
  'CSS',
  'HTML',
  'JSON',
  'REST',
  'HTTP',
  'HTTPS',
  'CI',
  'CD',
  'AWS',
  'GCP',
  'SLA',
  'KPI',
  'KPIS',
  'ETL',
  'CRM',
  'ERP',
  'SEO',
  'UX',
  'UI',
  'QA',
  'HR',
  'IT',
  'PDF',
  'CV',
  'BSc',
  'BCom',
  'BA',
  'MBA',
  'PhD',
  'NQF',
]);

/**
 * Two or more consecutive capitalised words: "Absa Bank", "Standard Bank
 * Group", "University of Pretoria". Requiring two words is what keeps
 * sentence-initial capitals out — "Delivered a payments API" does not match,
 * "Delivered Absa Bank" does.
 */
const PROPER_NOUN_PHRASE =
  /\b([A-Z][a-zA-Z&.'-]+(?:\s+(?:of|for|and|the|de|van)\s+)?(?:\s+[A-Z][a-zA-Z&.'-]+)+)\b/g;

/**
 * Single-word employers, caught by the words that introduce them.
 *
 * "Google", "Absa", "Vodacom", "Shoprite", "Discovery" are all one word, so the
 * two-word rule above misses every one of them. What gives them away is the
 * preposition: you work *at* an employer. This is the pattern that catches
 * "Worked at Google from 2015" — the exact shape a fabricated employer takes.
 */
const EMPLOYER_CONTEXT =
  /\b(?:at|for|with|joined|employed\s+by|contracted\s+to)\s+([A-Z][a-zA-Z&.'-]+(?:\s+[A-Z][a-zA-Z&.'-]+)*)/g;

/** Standalone acronyms of two or more capitals: "ABSA", "SARS", "MTN". */
const ACRONYM = /\b([A-Z]{2,})\b/g;

/** Four-digit years in a plausible working range. */
const YEAR = /\b(19[5-9]\d|20[0-4]\d)\b/g;

function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when this reads as a technology or competency rather than a company. */
function isKnownSkillTerm(phrase: string): boolean {
  const canonical = canonicalise(phrase);
  return (
    canonical in SKILL_ALIASES ||
    PROSE_MATCHABLE_VOCABULARY.some((term) => canonicalise(term) === canonical)
  );
}

/** Organisations and dates asserted in a piece of generated text. */
export function extractProvenanceMentions(
  text: string,
): readonly ProvenanceMention[] {
  const mentions: ProvenanceMention[] = [];
  const seen = new Set<string>();

  const add = (raw: string, kind: ProvenanceMention['kind']): void => {
    const trimmed = raw.trim();
    const key = `${kind}:${normalise(trimmed)}`;
    if (!trimmed || seen.has(key)) return;
    seen.add(key);
    mentions.push({ text: trimmed, kind });
  };

  for (const match of text.matchAll(PROPER_NOUN_PHRASE)) {
    const phrase = match[1];
    if (NOT_ORGANISATIONS.has(normalise(phrase))) continue;
    add(phrase, 'employer');
  }

  for (const match of text.matchAll(EMPLOYER_CONTEXT)) {
    const phrase = match[1];
    if (NOT_ORGANISATIONS.has(normalise(phrase))) continue;
    // "worked with Kubernetes" is a skill claim, not an employer one. Let the
    // skill rules judge it — they will, and the message they give the user
    // will make sense. Reporting it here as an unnamed organisation would
    // block it for a confusing reason.
    if (isKnownSkillTerm(phrase)) continue;
    add(phrase, 'employer');
  }

  for (const match of text.matchAll(ACRONYM)) {
    const acronym = match[1];
    if (NOT_ACRONYM_ORGANISATIONS.has(acronym)) continue;
    add(acronym, 'employer');
  }

  for (const match of text.matchAll(YEAR)) {
    add(match[1], 'date');
  }

  return mentions;
}

/**
 * True when the source CV names this organisation or date.
 *
 * Matching is on normalised text, so "Absa Bank" in the draft is satisfied by
 * "ABSA Bank," in the CV. It is deliberately a containment check rather than an
 * exact one: the model is allowed to write "Absa" where the CV said "Absa Bank
 * Limited", because that is shortening a real employer, not inventing one.
 */
export function appearsInSource(mention: string, sourceText: string): boolean {
  const needle = normalise(mention);
  if (!needle) return false;
  return normalise(sourceText).includes(needle);
}
