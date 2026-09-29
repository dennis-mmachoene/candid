/**
 * Guarantee 1 — Candid never leaks identity.
 *
 * Every path that reaches an AI provider passes through `deidentify()` first.
 * It does three things, in this order:
 *
 *   1. Redacts South African ID numbers (Luhn-checked, date-checked) so they
 *      are gone before any other processing can copy them elsewhere.
 *   2. Splits off the CV's header block and lifts the name, email and phone
 *      out of it. That block is presumed identifying in its entirety.
 *   3. Scrubs any residual occurrence of those identifiers from the body — a
 *      name repeated in a footer or an email in a project description would
 *      otherwise sail straight through.
 *
 * The identity is reattached server-side, after the model has replied. It never
 * crosses the network to Claude.
 *
 * A deliberate asymmetry runs through this file: when detection is uncertain we
 * over-redact rather than under-redact. Losing a word of a job description is a
 * cosmetic problem; leaking a name is a breach.
 */

import type { DeidentificationResult, IdentityHeader } from './types';

export const ID_REDACTION = '[ID NUMBER REDACTED]';
export const EMAIL_REDACTION = '[EMAIL REDACTED]';
export const PHONE_REDACTION = '[PHONE REDACTED]';
export const NAME_REDACTION = '[NAME REDACTED]';

/** Header blocks longer than this are almost certainly a parse artefact. */
const MAX_HEADER_LINES = 15;
/** Used when a CV has no recognisable section heading at all. */
const FALLBACK_HEADER_LINES = 6;
/** Name fragments shorter than this are too collision-prone to scrub safely. */
const MIN_SCRUBBABLE_NAME_PART = 3;

// ---------------------------------------------------------------------------
// South African ID numbers
// ---------------------------------------------------------------------------

/**
 * A South African ID number is 13 digits: YYMMDD SSSS C A Z, where the final
 * digit is a Luhn check digit over the preceding twelve.
 *
 * The separator group allows the spaced and hyphenated forms people actually
 * type ("800101 5009 088"). With no separators this reduces to a plain 13-digit
 * run, which is the form the spec names.
 */
const SA_ID_PATTERN = /(?<!\d)(\d{6})[\s-]?(\d{4})[\s-]?(\d{3})(?!\d)/g;

/** Standard Luhn checksum over the full 13 digits. Valid when sum % 10 === 0. */
export function luhnIsValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * True when the first six digits read as a calendar date.
 *
 * February is allowed 29 days unconditionally: a two-digit year cannot tell us
 * whether `00` means 1900 (not a leap year) or 2000 (one), and refusing a real
 * ID because of that ambiguity would leak it.
 */
export function isPlausibleYyMmDd(six: string): boolean {
  if (!/^\d{6}$/.test(six)) return false;
  const month = Number(six.slice(2, 4));
  const day = Number(six.slice(4, 6));
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

/** True when a 13-digit string satisfies both the date and the check digit. */
export function isSouthAfricanIdNumber(digits: string): boolean {
  return (
    /^\d{13}$/.test(digits) &&
    isPlausibleYyMmDd(digits.slice(0, 6)) &&
    luhnIsValid(digits)
  );
}

/**
 * Replace every South African ID number with `[ID NUMBER REDACTED]`.
 *
 * Thirteen-digit runs that fail either check are left alone — an invoice
 * reference or a long account number should survive de-identification intact.
 */
export function redactSaIdNumbers(text: string): {
  text: string;
  count: number;
} {
  let count = 0;
  const redacted = text.replace(
    SA_ID_PATTERN,
    (match, a: string, b: string, c: string) => {
      const digits = `${a}${b}${c}`;
      if (!isSouthAfricanIdNumber(digits)) return match;
      count += 1;
      return ID_REDACTION;
    },
  );
  return { text: redacted, count };
}

// ---------------------------------------------------------------------------
// Header block detection
// ---------------------------------------------------------------------------

/**
 * Headings that conventionally open the substantive part of a CV. The header
 * block is everything above the first one of these.
 */
const SECTION_HEADINGS = [
  'profile',
  'summary',
  'professional summary',
  'career summary',
  'personal statement',
  'objective',
  'career objective',
  'about me',
  'experience',
  'work experience',
  'professional experience',
  'employment',
  'employment history',
  'work history',
  'education',
  'qualifications',
  'academic background',
  'skills',
  'technical skills',
  'core competencies',
  'key skills',
  'certifications',
  'certificates',
  'projects',
  'achievements',
  'accomplishments',
  'references',
  'languages',
  'interests',
  'volunteer',
  'volunteering',
  'publications',
  'awards',
] as const;

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/**
 * Phone shapes, most specific first. South African forms are listed explicitly
 * because a generic "run of digits" pattern would swallow dates and postcodes.
 */
const PHONE_PATTERNS: readonly RegExp[] = [
  // +27 82 123 4567 / 0027 82 123 4567
  /(?:\+|00)27[\s.\-()]*\d(?:[\s.\-()]*\d){8}/g,
  // 082 123 4567 — a leading zero followed by nine more digits
  /(?<!\d)0\d(?:[\s.\-()]*\d){8}(?!\d)/g,
  // Generic international, e.g. +44 20 7946 0958
  /\+\d{1,3}[\s.\-()]*\d(?:[\s.\-()]*\d){6,13}/g,
  /*
   * North American, e.g. (217) 097-5477 and 304-264-5413.
   *
   * Added because it was measured, not because it was imagined. Run against
   * 2483 published resumes, the three patterns above removed every email
   * address and 40 of 147 telephone numbers. The 107 survivors were all this
   * shape: ten digits in three-three-four with separators, and no country code
   * for the patterns above to find.
   *
   * The brackets are optional on both sides rather than paired, which looks
   * careless and is not. PDF text extraction routinely loses one of them, so
   * the survivors included "(910-432-2392" and "865) 336-4800". A pattern that
   * insisted on matching brackets would have left exactly those behind.
   *
   * The separator is required. Without it this would be a bare ten-digit run,
   * which is how a pattern starts eating reference numbers — the failure the
   * comment above this list warns about. Requiring it keeps the rule narrow
   * enough that the over-redaction rate stayed where it was.
   */
  /(?<!\d)\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}(?!\d)/g,
];

const URL_PATTERN = /(https?:\/\/|www\.|linkedin\.com|github\.com)/i;

function isSectionHeading(line: string): boolean {
  const normalised = line
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim();
  if (!normalised || normalised.length > 40) return false;
  return SECTION_HEADINGS.some((heading) => normalised === heading);
}

/**
 * Heuristic name detection: a short line of alphabetic words, none of which is
 * an email, phone or URL. Real CVs put the name on the first such line
 * essentially without exception.
 *
 * This is a heuristic and can miss. That is why it is not the only defence —
 * the entire header block is withheld regardless of whether a name is
 * recognised inside it.
 */
export function looksLikeName(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 60) return false;
  if (/\d/.test(trimmed)) return false;
  if (URL_PATTERN.test(trimmed)) return false;
  if (trimmed.includes('@')) return false;

  const words = trimmed.split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  if (!words.every((w) => /^[A-Za-zÀ-ÿ'’-]+$/.test(w))) return false;

  const capitalised = words.every((w) => /^[A-ZÀ-Þ]/.test(w));
  const allCaps = trimmed === trimmed.toUpperCase();
  return capitalised || allCaps;
}

/**
 * Does this line look like part of a header block rather than a sentence of
 * experience? Short, no terminal punctuation, or it carries an identifier.
 */
function looksLikeHeaderLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (trimmed.includes('@')) return true;
  if (URL_PATTERN.test(trimmed)) return true;
  if (findPhone(trimmed)) return true;
  if (looksLikeName(trimmed)) return true;
  // An address or a title: short, and not a sentence.
  return trimmed.length <= 60 && !/[.!?]$/.test(trimmed);
}

/**
 * Split a CV into its (presumed identifying) header block and its body.
 *
 * When no conventional section heading is found we do not blindly cut a fixed
 * number of lines. We take only the leading lines that still look like header
 * material and stop at the first line that reads like real content.
 *
 * That detail is what makes `deidentify()` safe to run twice. Already
 * de-identified text has no header left, so nothing is cut, and the function
 * becomes idempotent — which lets the tailoring path re-run it as a safety net
 * on stored content without quietly deleting the first six lines of someone's
 * experience.
 */
export function splitHeaderBlock(text: string): {
  headerLines: string[];
  bodyLines: string[];
} {
  const lines = text.split(/\r?\n/);
  let boundary = lines.findIndex(isSectionHeading);

  if (boundary === -1) {
    boundary = 0;
    const limit = Math.min(FALLBACK_HEADER_LINES, lines.length);
    while (boundary < limit && looksLikeHeaderLine(lines[boundary])) {
      boundary += 1;
    }
  } else if (boundary > MAX_HEADER_LINES) {
    boundary = MAX_HEADER_LINES;
  }

  return {
    headerLines: lines.slice(0, boundary),
    bodyLines: lines.slice(boundary),
  };
}

function firstMatch(text: string, pattern: RegExp): string | null {
  const re = new RegExp(pattern.source, pattern.flags);
  const match = re.exec(text);
  return match ? match[0].trim() : null;
}

function findPhone(text: string): string | null {
  for (const pattern of PHONE_PATTERNS) {
    const found = firstMatch(text, pattern);
    if (found) return found;
  }
  return null;
}

/**
 * Lift the identifiers out of a header block.
 *
 * Every line that is not consumed as the name, email or phone is kept in
 * `otherLines` and withheld too — an address or a portfolio URL is identifying
 * even though it is none of those three.
 */

/**
 * Places a South African employer filters on.
 *
 * Nine provinces and the cities that carry most of the country's job adverts.
 * A list rather than a pattern because a place name has no shape to match —
 * and because the failure of a list is a missed city, which is recoverable,
 * while the failure of a loose pattern is somebody's street address printed on
 * their CV.
 */
const SA_LOCATIONS: readonly string[] = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'KwaZulu Natal',
  'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape',
  'Johannesburg', 'Pretoria', 'Tshwane', 'Cape Town', 'Durban', 'eThekwini',
  'Port Elizabeth', 'Gqeberha', 'East London', 'Bloemfontein', 'Mangaung',
  'Polokwane', 'Nelspruit', 'Mbombela', 'Kimberley', 'Rustenburg', 'Soweto',
  'Sandton', 'Midrand', 'Centurion', 'Randburg', 'Roodepoort', 'Boksburg',
  'Benoni', 'Kempton Park', 'Vereeniging', 'Vanderbijlpark', 'Witbank',
  'eMalahleni', 'Emalahleni', 'Stellenbosch', 'Paarl', 'George', 'Knysna',
  'Pietermaritzburg', 'Richards Bay', 'Newcastle', 'Umhlanga', 'Ballito',
  'Sasolburg', 'Welkom', 'Klerksdorp', 'Potchefstroom', 'Mahikeng', 'Upington',
  'Springbok', 'Thohoyandou', 'Giyani', 'Tzaneen', 'Secunda', 'Middelburg',
];

const SA_PROVINCES = new Set([
  'eastern cape', 'free state', 'gauteng', 'kwazulu-natal', 'kwazulu natal',
  'limpopo', 'mpumalanga', 'northern cape', 'north west', 'western cape',
]);

/** LinkedIn, GitHub and anything else a candidate lists as a profile. */
const PROFILE_LINK =
  /\b((?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com|stackoverflow\.com|medium\.com)\/[^\s,|]+)/gi;

/**
 * City and province only, taken from the header block.
 *
 * The matched place names are returned, never the line they were found on.
 * "12 Rissik Street, Braamfontein, Johannesburg 2001" yields "Johannesburg" —
 * the street stays behind, which is both what an employer needs and less than
 * we would otherwise be keeping.
 */
export function extractLocation(headerLines: readonly string[]): string | null {
  const text = headerLines.join(' | ');
  const found: string[] = [];

  for (const place of SA_LOCATIONS) {
    const pattern = new RegExp(`(?<![A-Za-z])${place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`, 'i');
    if (pattern.test(text) && !found.some((f) => f.toLowerCase() === place.toLowerCase())) {
      found.push(place);
    }
  }

  if (found.length === 0) return null;

  // City first, then province — "Pretoria, Gauteng", the way a person writes
  // it. The list is alphabetical, so without this the province leads.
  const cities = found.filter((place) => !SA_PROVINCES.has(place.toLowerCase()));
  const provinces = found.filter((place) => SA_PROVINCES.has(place.toLowerCase()));

  // A city and its province is the most anyone needs. More reads as clutter.
  return [...cities.slice(0, 1), ...provinces.slice(0, 1)].join(', ') || found[0];
}

/** Profile links from the header block, de-duplicated, in the order found. */
export function extractLinks(headerLines: readonly string[]): string[] {
  const seen = new Set<string>();
  const links: string[] = [];
  for (const match of headerLines.join('\n').matchAll(PROFILE_LINK)) {
    const link = match[1].replace(/[.,;]+$/, '');
    const key = link.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    links.push(link);
  }
  return links;
}

// ---------------------------------------------------------------------------
// Links in the body
// ---------------------------------------------------------------------------

/**
 * A web address anywhere below the header block.
 *
 * `PROFILE_LINK` above only has to know the profile sites, because everything
 * in the header block is withheld whatever it is. The body is different. A link
 * can sit in a project bullet, and one did:
 *
 *   GitHub: https://github.com/dennis-mmachoene/smart-crops-solutions
 *
 * The residual scrub then removed the applicant's name from it, on word
 * boundaries, exactly as designed, and the exported CV carried
 *
 *   github.com/[NAME REDACTED]-[NAME REDACTED]/smart-crops-solutions
 *
 * which is worse than either keeping the link or dropping it. The scrub was
 * right; it simply ran on text that should not have been there to scrub.
 *
 * So links are lifted out before the scrub runs, and put back at export. The
 * second branch matches a bare domain with a path, because PDF extraction drops
 * the scheme often enough to matter. Its list of endings is short on purpose: a
 * pattern that accepted any dotted word followed by a slash would eat
 * "Node.js/React" and "Agile/Scrum".
 */
const BODY_LINK =
  /\b(?:https?:\/\/|www\.)[^\s<>"'|)\]]+|\b(?:[a-z0-9-]+\.)+(?:com|co\.za|org|net|io|dev|ai|app|me)\/[^\s<>"'|)\]]+/gi;

/** Trailing punctuation belongs to the sentence, not to the address. */
const LINK_TAIL = /[.,;:!?)\]]+$/;

/** How a withheld link appears in the text the model is given. */
export function linkMarker(index: number): string {
  return `[LINK ${index + 1}]`;
}

const LINK_MARKER_PATTERN = /\[LINK (\d+)\]/g;

/**
 * Compare two spellings of the same address.
 *
 * A CV routinely writes its own GitHub twice, once with the scheme in the
 * header and once without it in a project. Those are one link and must get one
 * marker, or the numbering drifts apart from `identity.links`.
 */
function sameLink(value: string): string {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
}

/**
 * Replace every address in `text` with a numbered marker.
 *
 * `known` is the list already lifted out of the header. Markers are numbered
 * against the returned list, so `[LINK 1]` is always `links[0]` and the two
 * halves can be reunited by position alone.
 */
export function withholdLinks(
  text: string,
  known: readonly string[] = [],
): { text: string; links: string[] } {
  const links = [...known];
  const positions = new Map<string, number>();
  links.forEach((link, index) => positions.set(sameLink(link), index));

  const output = text.replace(BODY_LINK, (match) => {
    const link = match.replace(LINK_TAIL, '');
    if (!link) return match;

    const key = sameLink(link);
    let index = positions.get(key);
    if (index === undefined) {
      index = links.length;
      links.push(link);
      positions.set(key, index);
    }

    // The punctuation that followed the address stays where it was.
    return `${linkMarker(index)}${match.slice(link.length)}`;
  });

  return { text: output, links };
}

/**
 * Put the addresses back.
 *
 * Called at export, on the server, at the same moment and for the same reason
 * as the rest of the identity. A marker with no matching link is left alone
 * rather than blanked, so a mismatch shows up as a visible `[LINK 4]` instead of
 * silently deleting a line.
 */
export function restoreLinks(text: string, links: readonly string[]): string {
  if (links.length === 0) return text;
  return text.replace(LINK_MARKER_PATTERN, (match, digits: string) => {
    return links[Number(digits) - 1] ?? match;
  });
}

// ---------------------------------------------------------------------------
// The professional title
// ---------------------------------------------------------------------------

/**
 * The line most people put directly under their name: "Full-Stack Developer".
 *
 * It was going into `otherLines` and being withheld with the address, which is
 * correct as a default and wrong for this one line — it is a job title, not an
 * identifier, and its absence is the most obvious difference between the CV
 * somebody uploads and the CV Candid gives back.
 *
 * Taken only from the header block, only above the first line carrying contact
 * details, and only when it reads like a title: a few words, no digits, no
 * punctuation that would make it a sentence.
 */
export function extractHeadline(
  headerLines: readonly string[],
  fullName: string | null,
): string | null {
  for (const raw of headerLines) {
    const line = raw.trim();
    if (!line) continue;
    if (fullName && line === fullName) continue;

    // Once contact details appear we are past the title. Stop rather than skip:
    // anything below the contact line is an address or a footer, not a title.
    if (line.includes('@') || URL_PATTERN.test(line) || findPhone(line)) return null;

    // A redaction marker means this line held an identifier. Leave it withheld.
    if (line.includes('[')) continue;

    if (/\d/.test(line)) continue;
    if (line.length > 50) continue;
    if (/[.!?,;:]$/.test(line)) continue;
    if (line.split(/\s+/).length > 6) continue;
    if (isOnlyALocation(line)) continue;

    return line;
  }
  return null;
}

/**
 * True when a line is a place and nothing else.
 *
 * "Pretoria, Gauteng" under a name is where the person is, not what they do,
 * and printing it as a job title would read as a mistake.
 */
function isOnlyALocation(line: string): boolean {
  let remainder = line;
  for (const place of SA_LOCATIONS) {
    remainder = remainder.replace(
      new RegExp(escapeRegExp(place), 'gi'),
      ' ',
    );
  }
  return remainder.replace(/[^A-Za-z]/g, '') === '';
}

export function extractIdentity(headerLines: readonly string[]): IdentityHeader {
  const headerText = headerLines.join('\n');
  const email = firstMatch(headerText, EMAIL_PATTERN);
  const phone = findPhone(headerText);

  let fullName: string | null = null;
  for (const line of headerLines) {
    if (looksLikeName(line)) {
      fullName = line.trim();
      break;
    }
  }

  const consumed = new Set<string>();
  const otherLines: string[] = [];
  for (const line of headerLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed === fullName) continue;
    if (email && trimmed === email) continue;
    if (phone && trimmed === phone) continue;
    if (consumed.has(trimmed)) continue;
    consumed.add(trimmed);
    otherLines.push(trimmed);
  }

  return {
    fullName,
    headline: extractHeadline(headerLines, fullName),
    email,
    phone,
    location: extractLocation(headerLines),
    links: extractLinks(headerLines),
    otherLines,
  };
}

// ---------------------------------------------------------------------------
// Residual scrubbing
// ---------------------------------------------------------------------------

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove identifiers that recur below the header block.
 *
 * Name fragments are scrubbed individually and case-insensitively, on word
 * boundaries. This can occasionally take a legitimate word — a candidate named
 * Grace losing the word "grace" from a sentence. That trade is made
 * deliberately and in one direction only: an over-scrubbed draft is visible to
 * the user and fixable, a leaked name is neither.
 */
export function scrubResidualIdentifiers(
  text: string,
  identity: IdentityHeader,
): string {
  let output = text.replace(EMAIL_PATTERN, EMAIL_REDACTION);

  for (const pattern of PHONE_PATTERNS) {
    output = output.replace(pattern, PHONE_REDACTION);
  }

  if (identity.fullName) {
    output = output.replace(
      new RegExp(escapeRegExp(identity.fullName), 'gi'),
      NAME_REDACTION,
    );

    for (const part of identity.fullName.split(/\s+/)) {
      if (part.length < MIN_SCRUBBABLE_NAME_PART) continue;
      output = output.replace(
        new RegExp(`\\b${escapeRegExp(part)}\\b`, 'gi'),
        NAME_REDACTION,
      );
    }
  }

  return output;
}

// ---------------------------------------------------------------------------
// The public entry point
// ---------------------------------------------------------------------------

/**
 * Turn raw parsed CV text into the only thing an AI provider may ever see.
 *
 * Order is load-bearing, and every step is here because of the step after it:
 *
 *   1. ID numbers first, so no later step can copy one into the header record.
 *   2. The header block is split off and withheld.
 *   3. Links in the body are replaced by markers, so that the next step cannot
 *      take a name out of the middle of a web address.
 *   4. Residual identifiers are scrubbed last, once we know what to look for.
 *
 * Swapping 3 and 4 is the defect this ordering was written to fix.
 */
export function deidentify(rawText: string): DeidentificationResult {
  const { text: withoutIds, count } = redactSaIdNumbers(rawText);
  const { headerLines, bodyLines } = splitHeaderBlock(withoutIds);
  const identity = extractIdentity(headerLines);

  const withheld = withholdLinks(bodyLines.join('\n'), identity.links);
  const content = scrubResidualIdentifiers(
    withheld.text,
    identity,
  ).trim();

  return {
    identity: { ...identity, links: withheld.links },
    content,
    redactedIdCount: count,
  };
}

/**
 * Reattach the withheld identity. Server-side only, after the model has
 * replied — this is the single point at which the two halves meet again.
 */
export function reattachIdentity<T>(
  document: T,
  identity: IdentityHeader,
): T & { identity: IdentityHeader } {
  return { ...document, identity };
}
