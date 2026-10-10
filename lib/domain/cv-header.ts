/**
 * Reading the header block off a CV.
 *
 * This file used to be `identity.ts`, and it used to do something different.
 * It split the header off a CV, redacted South African identity numbers,
 * scrubbed every residual name and phone number out of the body, and handed
 * the model a de-identified document. The identity came back only at export.
 *
 * That is gone. Candid is a job application platform used with test CVs, and
 * the de-identification layer was the biggest source of confusion in the
 * product: an upload button that said "de-identify", a consent gate before
 * anything could be done, and a preview that hid the applicant's own name from
 * them. The model now receives the CV as written.
 *
 * What survives is the useful half. Reading the header is still worth doing,
 * because it means an applicant uploads a CV once and their profile fills
 * itself in: name, title, email, phone, city and links. They can correct any
 * of it afterwards.
 *
 * Two things are deliberately NOT here any more, and should not come back:
 *
 *   - Identity-number redaction. Nothing stores an identity number, so there
 *     is nothing to redact. The schema still has no column for one.
 *   - Residual scrubbing. It existed to protect the model's input. The model
 *     now sees the whole CV.
 */

import type { CvHeader } from './types';

/** Header blocks longer than this are almost certainly a parse artefact. */
const MAX_HEADER_LINES = 15;
/** Used when a CV has no recognisable section heading at all. */
const FALLBACK_HEADER_LINES = 6;

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
 *
 * The fourth was added because it was measured, not imagined. Across 2 483
 * published resumes the first three patterns found 40 of 147 telephone
 * numbers. The 107 survivors were all North American: ten digits in
 * three-three-four with separators and no country code. The brackets are
 * optional on both sides rather than paired, which looks careless and is not,
 * because PDF extraction routinely loses one of them.
 */
const PHONE_PATTERNS: readonly RegExp[] = [
  // +27 82 123 4567 / 0027 82 123 4567
  /(?:\+|00)27[\s.\-()]*\d(?:[\s.\-()]*\d){8}/g,
  // 082 123 4567 — a leading zero followed by nine more digits
  /(?<!\d)0\d(?:[\s.\-()]*\d){8}(?!\d)/g,
  // Generic international, e.g. +44 20 7946 0958
  /\+\d{1,3}[\s.\-()]*\d(?:[\s.\-()]*\d){6,13}/g,
  // North American, e.g. (217) 097-5477 and 304-264-5413
  /(?<!\d)\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}(?!\d)/g,
];

const URL_PATTERN = /(https?:\/\/|www\.|linkedin\.com|github\.com)/i;

/** LinkedIn, GitHub and anything else somebody lists as a profile. */
const PROFILE_LINK =
  /\b((?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|gitlab\.com|behance\.net|dribbble\.com|stackoverflow\.com|medium\.com)\/[^\s,|]+)/gi;

/**
 * Places a South African employer filters on.
 *
 * Nine provinces and the cities that carry most of the country's job adverts.
 * A list rather than a pattern because a place name has no shape to match.
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isSectionHeading(line: string): boolean {
  const normalised = line
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim();
  if (!normalised || normalised.length > 40) return false;
  return SECTION_HEADINGS.some((heading) => normalised === heading);
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
 * A short line of alphabetic words, none of which is an email, phone or URL.
 * Real CVs put the name on the first such line essentially without exception.
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
 * experience? Short, no terminal punctuation, or it carries contact details.
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
 * Split a CV into its header block and its body.
 *
 * When no conventional section heading is found we do not blindly cut a fixed
 * number of lines. We take only the leading lines that still look like header
 * material and stop at the first line that reads like real content.
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

/**
 * City and province only, taken from the header block.
 *
 * The matched place names are returned, never the line they were found on.
 * "12 Rissik Street, Braamfontein, Johannesburg 2001" yields "Johannesburg".
 * The street stays behind, which is what an employer needs and less than we
 * would otherwise be keeping.
 */
export function extractLocation(headerLines: readonly string[]): string | null {
  const text = headerLines.join(' | ');
  const found: string[] = [];

  for (const place of SA_LOCATIONS) {
    const pattern = new RegExp(
      `(?<![A-Za-z])${escapeRegExp(place)}(?![A-Za-z])`,
      'i',
    );
    if (
      pattern.test(text) &&
      !found.some((f) => f.toLowerCase() === place.toLowerCase())
    ) {
      found.push(place);
    }
  }

  if (found.length === 0) return null;

  // City first, then province, the way a person writes it. The list is
  // alphabetical, so without this the province leads.
  const cities = found.filter((p) => !SA_PROVINCES.has(p.toLowerCase()));
  const provinces = found.filter((p) => SA_PROVINCES.has(p.toLowerCase()));

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

/**
 * True when a line is a place and nothing else.
 *
 * "Pretoria, Gauteng" under a name is where the person is, not what they do,
 * and printing it as a job title would read as a mistake.
 */
function isOnlyALocation(line: string): boolean {
  let remainder = line;
  for (const place of SA_LOCATIONS) {
    remainder = remainder.replace(new RegExp(escapeRegExp(place), 'gi'), ' ');
  }
  return remainder.replace(/[^A-Za-z]/g, '') === '';
}

/**
 * The line most people put directly under their name: "Full-Stack Developer".
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

    // Once contact details appear we are past the title. Stop rather than
    // skip: anything below the contact line is an address or a footer.
    if (line.includes('@') || URL_PATTERN.test(line) || findPhone(line)) return null;

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
 * Read the header block into the fields a profile holds.
 *
 * Everything returned is the applicant's own text. Nothing is withheld,
 * nothing is encrypted, and the body of the CV is untouched.
 */
export function readHeader(text: string): CvHeader {
  const { headerLines } = splitHeaderBlock(text);
  const headerText = headerLines.join('\n');

  let fullName: string | null = null;
  for (const line of headerLines) {
    if (looksLikeName(line)) {
      fullName = line.trim();
      break;
    }
  }

  return {
    fullName,
    headline: extractHeadline(headerLines, fullName),
    email: firstMatch(headerText, EMAIL_PATTERN),
    phone: findPhone(headerText),
    location: extractLocation(headerLines),
    links: extractLinks(headerLines),
  };
}
