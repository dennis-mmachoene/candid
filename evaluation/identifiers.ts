/**
 * Ground truth for the identity measurements.
 *
 * Everything in this file is deliberately written from scratch rather than
 * imported from `lib/domain/identity.ts`, and that is the whole point.
 *
 * If the harness verified de-identification using the same regular expressions
 * that performed it, it would only ever prove that a function agrees with
 * itself. A pattern that misses a phone format would miss it twice: once when
 * redacting and once when checking, and the measurement would report a clean
 * sweep. Checking with independent patterns is what makes a leak visible.
 *
 * The same reasoning applies to the Luhn implementation below. It exists so
 * that the identity numbers injected into resumes are valid by the published
 * standard, not merely valid according to the code under evaluation.
 */

// ---------------------------------------------------------------------------
// Luhn, implemented independently
// ---------------------------------------------------------------------------

/**
 * Luhn checksum (Luhn, 1960), written here without reference to the
 * implementation in lib/domain. Valid when the total is divisible by ten.
 */
export function luhnTotal(digits: string): number {
  let total = 0;
  let doubling = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let value = Number(digits[index]);
    if (doubling) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    total += value;
    doubling = !doubling;
  }

  return total;
}

export function isLuhnValid(digits: string): boolean {
  return /^\d+$/.test(digits) && luhnTotal(digits) % 10 === 0;
}

/**
 * Build a valid thirteen-digit South African identity number.
 *
 * Structure is YYMMDD SSSS C A Z. The first six digits are a date of birth, the
 * next four a sequence, then a citizenship digit, a legacy digit, and finally a
 * Luhn check digit over everything before it.
 *
 * The check digit is found by trying all ten and keeping the one that
 * validates, rather than by deriving it. Slower by a rounding error, and
 * impossible to get subtly wrong.
 *
 * These are synthetic. The date and sequence are generated, so any collision
 * with a real person's number is coincidence, and none of them is ever stored.
 */
export function makeSaIdNumber(seed: number): string {
  const year = String(60 + (seed % 40)).padStart(2, '0');
  const month = String(1 + (seed % 12)).padStart(2, '0');
  const day = String(1 + (seed % 28)).padStart(2, '0');
  const sequence = String(1000 + (seed % 8999)).padStart(4, '0');
  const citizenship = String(seed % 2);
  const legacy = '8';

  const first12 = `${year}${month}${day}${sequence}${citizenship}${legacy}`;

  for (let check = 0; check <= 9; check += 1) {
    const candidate = `${first12}${check}`;
    if (isLuhnValid(candidate)) return candidate;
  }

  throw new Error(`No valid check digit for ${first12}, which cannot happen.`);
}

// ---------------------------------------------------------------------------
// Independent detection patterns
// ---------------------------------------------------------------------------

/** Any address-shaped token. Broader than the redactor's, on purpose. */
export const EMAIL_LIKE = /[^\s<>@]+@[^\s<>@]+\.[A-Za-z]{2,}/g;

/**
 * Telephone shapes, written to be generous rather than precise.
 *
 * A checker that is stricter than the redactor cannot find a leak the redactor
 * let through, so this errs the other way. False positives here make the
 * measured leak rate look worse than it is, which is the safe direction for a
 * number you are going to publish.
 */
export const PHONE_LIKE: readonly RegExp[] = [
  // +27 82 123 4567, 0027 82 123 4567
  /(?:\+|00)\s?27[\s.\-()]*\d(?:[\s.\-()]*\d){8}/g,
  // 082 123 4567
  /(?<!\d)0\d(?:[\s.\-()]*\d){8}(?!\d)/g,
  // (217) 097-5477 and 910-432-2392, the North American shapes in the dataset
  /\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/g,
  // Generic international
  /\+\d{1,3}[\s.\-()]*\d(?:[\s.\-()]*\d){6,13}/g,
];

/** Thirteen-digit runs, including the spaced and hyphenated forms. */
export const THIRTEEN_DIGIT_RUN = /(?<!\d)(\d{6})[\s-]?(\d{4})[\s-]?(\d{3})(?!\d)/g;

export function findEmails(text: string): string[] {
  return [...text.matchAll(EMAIL_LIKE)].map((match) => match[0]);
}

export function findPhones(text: string): string[] {
  const found: string[] = [];
  for (const pattern of PHONE_LIKE) {
    for (const match of text.matchAll(new RegExp(pattern.source, 'g'))) {
      found.push(match[0]);
    }
  }
  return found;
}

/** Every thirteen-digit run in the text, as bare digits. */
export function findThirteenDigitRuns(text: string): string[] {
  return [...text.matchAll(THIRTEEN_DIGIT_RUN)].map(
    (match) => `${match[1]}${match[2]}${match[3]}`,
  );
}

/**
 * Does this thirteen-digit run read as a South African identity number?
 *
 * Independent of the domain implementation, for the reason at the top of this
 * file. February is allowed 29 days because a two-digit year cannot say whether
 * 00 means 1900 or 2000.
 */
export function looksLikeSaId(digits: string): boolean {
  if (!/^\d{13}$/.test(digits)) return false;

  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));
  const daysInMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth[month - 1]) return false;

  return isLuhnValid(digits);
}

// ---------------------------------------------------------------------------
// Synthetic identity headers
// ---------------------------------------------------------------------------

export interface SyntheticIdentity {
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  idNumber: string;
  address: string;
}

/**
 * South African names, so the header looks like the CVs Candid is built for.
 * Invented combinations; any resemblance to a real person is coincidence.
 */
const FIRST_NAMES = [
  'Naledi', 'Thabo', 'Lerato', 'Sipho', 'Nomsa', 'Kagiso', 'Zanele',
  'Mpho', 'Refilwe', 'Tebogo', 'Ayanda', 'Bongani', 'Palesa', 'Karabo',
];

const LAST_NAMES = [
  'Sithole', 'Mokoena', 'Dlamini', 'Nkosi', 'Khumalo', 'Mahlangu',
  'Molefe', 'Ndlovu', 'Mabaso', 'Radebe', 'Tshabalala', 'Maluleke',
];

const CITIES = [
  'Johannesburg', 'Pretoria', 'Cape Town', 'Durban', 'Polokwane',
  'Bloemfontein', 'Nelspruit', 'Kimberley',
];

/**
 * A complete, known identity header to inject into a resume.
 *
 * Deterministic from the seed, so a run is reproducible and a surprising result
 * can be investigated rather than merely re-rolled.
 */
export function makeIdentity(seed: number): SyntheticIdentity {
  const firstName = FIRST_NAMES[seed % FIRST_NAMES.length];
  const lastName = LAST_NAMES[(seed * 7) % LAST_NAMES.length];
  const city = CITIES[(seed * 3) % CITIES.length];

  // 0XX XXX XXXX, the South African mobile shape.
  const phone = `0${82 + (seed % 3)} ${String(100 + (seed % 900))} ${String(
    1000 + (seed % 9000),
  )}`;

  return {
    fullName: `${firstName} ${lastName}`,
    firstName,
    lastName,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.co.za`,
    phone,
    idNumber: makeSaIdNumber(seed),
    address: `${1 + (seed % 200)} Church Street, ${city}`,
  };
}

/**
 * Put the header where a real CV puts it, above everything else.
 *
 * The published resumes have already had their headers removed, so the text
 * begins at a job title. Prepending a header restores the shape of the document
 * Candid actually receives, and gives the measurement exact ground truth: we
 * know precisely which strings must not survive.
 */
export function injectIdentity(
  resumeText: string,
  identity: SyntheticIdentity,
): string {
  return [
    identity.fullName,
    identity.email,
    identity.phone,
    identity.address,
    `ID Number: ${identity.idNumber}`,
    '',
    resumeText.trim(),
  ].join('\n');
}

/** Every string that must be gone after de-identification. */
export function leakedValues(
  identity: SyntheticIdentity,
  content: string,
): string[] {
  const digitsOnly = content.replace(/\D/g, '');

  const leaks: string[] = [];
  const check = (label: string, value: string): void => {
    if (value && content.includes(value)) leaks.push(`${label}:${value}`);
  };

  check('fullName', identity.fullName);
  check('firstName', identity.firstName);
  check('lastName', identity.lastName);
  check('email', identity.email);
  check('phone', identity.phone);
  check('idNumber', identity.idNumber);

  // Caught as written above; caught as bare digits here. A number that survives
  // with its spaces stripped has still leaked.
  if (digitsOnly.includes(identity.idNumber)) {
    leaks.push(`idNumber(digits):${identity.idNumber}`);
  }
  if (digitsOnly.includes(identity.phone.replace(/\D/g, ''))) {
    leaks.push(`phone(digits):${identity.phone}`);
  }

  return [...new Set(leaks)];
}
