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

// ---------------------------------------------------------------------------
// Quoted provenance — the model shows its working
// ---------------------------------------------------------------------------

/**
 * Why this replaced the previous approach entirely.
 *
 * Verification used to work by position: find the employer's line, decide which
 * nearby lines belonged to that job, and require the title and dates to fall
 * inside. It read well and it was wrong, because position is a property of
 * formatting rather than of truth.
 *
 * Measured against three real layouts:
 *
 *   employer, title and dates on one line          accepted
 *   title on one line, employer on the next        REFUSED
 *   a Word table, one field per cell               REFUSED
 *
 * Two of three. And it failed in the worst direction — an unrecognised layout
 * did not degrade, it deleted the job. A person with eight years of history
 * downloaded a CV showing three, with no error and one number in a count.
 *
 * A quote is layout-independent. The model reads the document however it is
 * shaped and reports the text it took each fact from. The only question here is
 * whether that text is genuinely in the CV, and whether it says what the model
 * claims it says.
 */

/** How the quoted text held up. */
export interface EvidenceCheck {
  /** The quote appears in the CV. */
  quoteFound: boolean;
  /** The quote contains the employer or institution being claimed. */
  employerInQuote: boolean;
  /** The quote contains the job title or award. Absent counts as fine. */
  titleInQuote: boolean;
  /** Dates claimed that the quote does not support. */
  untracedDates: readonly string[];
}

/** Words a CV uses to say something has not ended. */
const OPEN_ENDED = /\b(present|current|currently|to\s?date|ongoing|now)\b/i;

/**
 * Whitespace-insensitive containment.
 *
 * A quote is compared with line breaks, tabs and runs of spaces flattened,
 * because a PDF extractor and a table cell will not reproduce them the way the
 * model saw them. Everything else must match.
 */
function flatten(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Is `name` present in `text` as a whole name rather than a fragment of a
 * longer one?
 *
 * "Bank" is a real word inside "Absa Bank", so a word-boundary match is not
 * enough. A capitalised word either side extends the name, and so does a
 * lowercase connector before it — which is what lets "University of Pretoria"
 * match while "Pretoria" does not. Punctuation ends a name.
 */
const NAME_CONNECTOR = /^(of|for|and|the|de|van|der|du|el|da|dos|&)$/i;

export function namedInFull(text: string, name: string): boolean {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return false;

  const pattern = new RegExp(
    parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'),
    'gi',
  );

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    const before = text.slice(0, index);
    const after = text.slice(index + match[0].length);

    const previous = /([A-Za-z&]+)\s+$/.exec(before)?.[1];
    const next = /^\s+([A-Za-z&]+)/.exec(after)?.[1];

    const extendedBefore =
      previous !== undefined &&
      (/^[A-Z&]/.test(previous) || NAME_CONNECTOR.test(previous));
    const extendedAfter = next !== undefined && /^[A-Z]/.test(next);

    if (!extendedBefore && !extendedAfter) return true;
  }
  return false;
}

/**
 * A shortened employer is the same employer.
 *
 * "Absa Bank" where the CV says "Absa Bank Limited" is a person dropping a
 * legal suffix, not inventing a company. Blocking that was a regression and it
 * is exactly the sort of thing a job seeker does without thinking.
 *
 * The rule is one-directional on purpose: the claim may be shorter than the CV,
 * never longer. Shortening drops detail. Extending adds it.
 */
const LEGAL_SUFFIX =
  /\s+(limited|ltd|pty|proprietary|inc|incorporated|plc|llc|llp|group|holdings|sa|za|npc|cc)\b\.?/gi;

function withoutSuffixes(name: string): string {
  return flatten(name.replace(LEGAL_SUFFIX, ' '));
}

function sameOrganisation(claimed: string, quote: string): boolean {
  if (namedInFull(quote, claimed)) return true;

  /*
   * The claim dropped a legal suffix the CV carries.
   *
   * The check is `namedInFull` again, against a copy of the quote with the
   * suffixes removed — not a plain substring test. A substring test was the
   * first attempt and it quietly undid the fragment rule: "Bank" is inside
   * "Absa Bank", so it matched, and a fragment satisfied a check for a name.
   *
   * Stripping "Limited" out of the quote and re-running the same whole-name
   * test keeps both properties. "Absa Bank" matches "Absa Bank Limited";
   * "Bank" still does not.
   */
  const shortened = withoutSuffixes(claimed);
  if (!shortened) return false;
  return namedInFull(quote.replace(LEGAL_SUFFIX, ' '), claimed.replace(LEGAL_SUFFIX, ' '));
}

/**
 * Check one fact against the text the model says it came from.
 *
 * `organisation` is the employer or the institution, `label` the job title or
 * the award. Both are handled the same way because both are claims about
 * somebody's history that the CV either supports or does not.
 */
export function checkEvidence(
  claim: {
    evidence: string;
    organisation: string;
    label: string;
    dates: readonly string[];
  },
  sourceCv: string,
): EvidenceCheck {
  const quote = claim.evidence.trim();
  const quoteFound = quote !== '' && flatten(sourceCv).includes(flatten(quote));

  if (!quoteFound) {
    return {
      quoteFound: false,
      employerInQuote: false,
      titleInQuote: false,
      untracedDates: claim.dates.filter((date) => date.trim() !== ''),
    };
  }

  const employerInQuote =
    claim.organisation.trim() === '' ? false : sameOrganisation(claim.organisation, quote);

  const titleInQuote =
    claim.label.trim() === '' || flatten(quote).includes(flatten(claim.label));

  const untracedDates = claim.dates
    .map((date) => date.trim())
    .filter((date) => {
      if (!date) return false;
      // "present" says the job has not ended. The quote has to say so too.
      if (OPEN_ENDED.test(date)) return !OPEN_ENDED.test(quote);
      return !flatten(quote).includes(flatten(date));
    });

  return { quoteFound, employerInQuote, titleInQuote, untracedDates };
}
