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
// Scoped provenance — a position judged as a whole
// ---------------------------------------------------------------------------

/**
 * Why `appearsInSource` is not enough for a position.
 *
 * That function asks one question: does this text appear anywhere in the CV.
 * For an employer invented out of nothing that is sufficient — "Standard Bank"
 * is absent, so it is blocked. For a date it is close to useless.
 *
 * Measured against a CV listing Absa Bank from 2020 and Dimension Data from
 * 2017 to 2020, every one of these passed the flat check:
 *
 *   Dimension Data, 2020 to present   — stretches a finished job to today
 *   Absa Bank, 2017 to present        — erases a real employment gap
 *   Bank / Senior / Pretoria          — fragments, and a city
 *
 * The years exist in the CV. They simply belong to a different employer. A flat
 * containment check cannot tell which date goes with which job, and a CV with
 * quietly wrong dates is precisely what a background check catches — the exact
 * failure this module's header says it exists to prevent.
 *
 * So a position is judged as a unit. Find the employer in the source, work out
 * which block of lines belongs to that job, and require the title and the dates
 * to be inside it.
 */

/** How a position's own assertions fared. */
export interface PositionTrace {
  /** The employer was found in the source as a whole organisation name. */
  employerTraced: boolean;
  /** The title appears within this employer's own block of the CV. */
  titleTraced: boolean;
  /** Dates claimed that are not supported inside this employer's block. */
  untracedDates: readonly string[];
}

/**
 * How far above the employer line a header may reach.
 *
 * Two covers "title on one line, employer and dates on the next", which is the
 * common two-line header. It is bounded by a blank line as well, so this is a
 * cap rather than the rule.
 */
const HEADER_LOOKBACK = 2;

/** Words a CV uses to say a job has not ended. */
const OPEN_ENDED = /\b(present|current|currently|to\s?date|ongoing|now)\b/i;

function isOpenEnded(value: string): boolean {
  return OPEN_ENDED.test(value.trim());
}

/** Lines that name an organisation, with the names they name. */
function organisationLines(
  lines: readonly string[],
): { index: number; names: string[] }[] {
  const found: { index: number; names: string[] }[] = [];
  lines.forEach((line, index) => {
    const names = extractProvenanceMentions(line)
      .filter((mention) => mention.kind === 'employer')
      .map((mention) => normalise(mention.text));
    if (names.length > 0) found.push({ index, names });
  });
  return found;
}

/** Lowercase words that sit inside a name rather than ending it. */
const NAME_CONNECTOR = /^(of|for|and|the|de|van|der|du|el|da|dos|&)$/i;

/**
 * Is this name present in the line *in full*, rather than as a fragment of a
 * longer one?
 *
 * Matching against extracted organisation phrases was the first attempt and it
 * was wrong. The extractor looks for runs of capitalised words, so it reports
 * "BSc Computer Science" and never "University of Pretoria" — the lowercase
 * "of" ends the run. Requiring equality with an extracted phrase therefore
 * blocked every institution whose name contains a connector, which is most of
 * them. The round-trip test caught it by finding no Education section at all.
 *
 * So the check works on the raw line and asks a narrower question: does the
 * text immediately either side of the match extend it into a longer name? A
 * capitalised word before or after does, and so does a lowercase connector
 * before. Punctuation does not — a comma or a bracket ends a name.
 *
 *   "Absa Bank"            in "Senior Developer, Absa Bank (2020 - present)"
 *                          -> comma before, bracket after. In full.
 *   "Bank"                 -> preceded by "Absa". A fragment.
 *   "Senior"               -> followed by "Developer". A fragment.
 *   "University of Pretoria" in "BSc Computer Science, University of Pretoria (2017)"
 *                          -> comma before, bracket after. In full.
 *   "Pretoria"             -> preceded by "of". A fragment.
 */
function namedInFull(line: string, name: string): boolean {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return false;

  const pattern = new RegExp(
    parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'),
    'gi',
  );

  for (const match of line.matchAll(pattern)) {
    const index = match.index ?? 0;
    const before = line.slice(0, index);
    const after = line.slice(index + match[0].length);

    // Only a space separates them — punctuation is a boundary, not an extension.
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

/** Whole-token containment, used for titles and dates inside a known region. */
function containsToken(haystack: string, needle: string): boolean {
  const n = normalise(needle);
  if (!n) return false;
  return new RegExp(`(?:^|\\s)${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`).test(
    normalise(haystack),
  );
}

/**
 * Judge one position against the CV it claims to come from.
 *
 * The block belonging to a job runs from the line naming its employer up to the
 * line naming the next one. Bounding it that way rather than by a fixed number
 * of lines is what makes this work on both common CV layouts — the one that
 * puts title, employer and dates on a single line, and the one that splits them
 * across two.
 */
export function tracePosition(
  position: {
    employer: string;
    title: string;
    startDate: string;
    endDate: string;
  },
  sourceLines: readonly string[],
): PositionTrace {
  const employer = position.employer.trim();
  const anchorIndex = sourceLines.findIndex((line) =>
    namedInFull(line, employer),
  );

  if (!employer || anchorIndex === -1) {
    // No employer, or one the CV never names. Everything else is moot: the
    // whole position is going to be dropped.
    return {
      employerTraced: false,
      titleTraced: false,
      untracedDates: [position.startDate, position.endDate].filter(
        (d) => d.trim() !== '',
      ),
    };
  }

  // The block belonging to this job runs from its own line to the line naming
  // the next organisation. Bounding it that way rather than by a fixed number
  // of lines is what makes a borrowed date visible: the other job's years are
  // outside the region, however close they sit on the page.
  const boundaries = organisationLines(sourceLines)
    .map((entry) => entry.index)
    .filter((index) => index > anchorIndex);
  const end = boundaries.length > 0 ? boundaries[0] : sourceLines.length;

  /*
   * The block also reaches backwards, and this was learned the hard way.
   *
   * Plenty of CVs put the job title on the line *above* the employer:
   *
   *     Software Developer & Researcher
   *     Council for Scientific and Industrial Research (CSIR) | April 2025 – Present
   *
   * Looking only forwards meant the title was never inside the region, so every
   * genuine position was refused for a title sitting one line away, and the
   * exported document came out as a name and a skills list. Worse than what it
   * replaced.
   *
   * The reach stops at a blank line, which is how CVs separate one job from the
   * next. That is what keeps the date scoping intact: walking back from the
   * second job cannot reach the first job's years, because there is a blank
   * line in between.
   */
  let start = anchorIndex;
  for (let back = 1; back <= HEADER_LOOKBACK; back += 1) {
    const index = anchorIndex - back;
    if (index < 0) break;
    if (sourceLines[index].trim() === '') break;
    start = index;
  }

  const region = sourceLines
    .slice(start, Math.max(anchorIndex + 1, end))
    .join('\n');

  const titleTraced =
    position.title.trim() === '' || containsToken(region, position.title);

  const untracedDates: string[] = [];
  for (const date of [position.startDate, position.endDate]) {
    const value = date.trim();
    if (!value) continue;

    if (isOpenEnded(value)) {
      // "present" is a claim that the job has not ended. It is legitimate only
      // if the CV says so in this job's own block. Letting it through because
      // the word appears against a *different* job is how a finished job gets
      // stretched to today.
      if (!isOpenEnded(region)) untracedDates.push(value);
      continue;
    }

    if (!containsToken(region, value)) untracedDates.push(value);
  }

  return { employerTraced: true, titleTraced, untracedDates };
}
