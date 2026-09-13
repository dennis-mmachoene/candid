/**
 * Proof of Guarantee 1 — Candid never leaks identity.
 *
 * The important test in this file is the last one. The others check the parts;
 * that one runs the real tailoring flow against a provider that records what it
 * was handed, and asserts on the exact payload that would have crossed the
 * network. Testing `deidentify()` in isolation would only prove the function
 * works, not that it is on the path.
 */

import { describe, expect, it } from 'vitest';

import {
  ID_REDACTION,
  PHONE_REDACTION,
  deidentify,
  extractIdentity,
  isPlausibleYyMmDd,
  isSouthAfricanIdNumber,
  looksLikeName,
  luhnIsValid,
  redactSaIdNumbers,
  scrubResidualIdentifiers,
  splitHeaderBlock,
} from '@/lib/domain/identity';
import { tailorCv } from '@/lib/domain/tailoring';
import {
  CV_WITH_IDENTIFIERS,
  IDENTIFIERS,
  IMPOSSIBLE_DATE_ID,
  INVALID_CHECKSUM_ID,
  JOB_ADVERT,
  MIXED_DRAFT,
  RecordingProvider,
  VALID_SA_ID,
} from './fixtures';

describe('South African ID numbers', () => {
  it('accepts a number with a correct Luhn check digit and a real date', () => {
    expect(luhnIsValid(VALID_SA_ID)).toBe(true);
    expect(isPlausibleYyMmDd(VALID_SA_ID.slice(0, 6))).toBe(true);
    expect(isSouthAfricanIdNumber(VALID_SA_ID)).toBe(true);
  });

  it('rejects a wrong check digit', () => {
    expect(luhnIsValid(INVALID_CHECKSUM_ID)).toBe(false);
    expect(isSouthAfricanIdNumber(INVALID_CHECKSUM_ID)).toBe(false);
  });

  it('rejects an impossible date', () => {
    expect(isPlausibleYyMmDd('801901')).toBe(false);
    expect(isSouthAfricanIdNumber(IMPOSSIBLE_DATE_ID)).toBe(false);
  });

  it('redacts a valid ID wherever it appears', () => {
    const { text, count } = redactSaIdNumbers(
      `ID: ${VALID_SA_ID} issued in Pretoria`,
    );
    expect(count).toBe(1);
    expect(text).toContain(ID_REDACTION);
    expect(text).not.toContain(VALID_SA_ID);
  });

  it('redacts the spaced and hyphenated forms people actually type', () => {
    const [a, b, c] = [
      VALID_SA_ID.slice(0, 6),
      VALID_SA_ID.slice(6, 10),
      VALID_SA_ID.slice(10),
    ];
    expect(redactSaIdNumbers(`${a} ${b} ${c}`).count).toBe(1);
    expect(redactSaIdNumbers(`${a}-${b}-${c}`).count).toBe(1);
  });

  /**
   * Over-redaction has a cost too: a CV full of `[ID NUMBER REDACTED]` where
   * invoice references used to be is a broken product. The Luhn and date checks
   * are what keep the rule narrow enough to be usable.
   */
  it('leaves ordinary long numbers alone', () => {
    const text = 'Processed invoices 1234567890123 and 9876543210987 in 2023.';
    const { text: out, count } = redactSaIdNumbers(text);
    expect(count).toBe(0);
    expect(out).toBe(text);
  });

  it('does not treat part of a longer digit run as an ID', () => {
    expect(redactSaIdNumbers(`${VALID_SA_ID}0000`).count).toBe(0);
  });
});

describe('header block detection', () => {
  it('cuts the header at the first conventional section heading', () => {
    const { headerLines, bodyLines } = splitHeaderBlock(CV_WITH_IDENTIFIERS);
    expect(headerLines.join('\n')).toContain(IDENTIFIERS.fullName);
    expect(headerLines.join('\n')).toContain(IDENTIFIERS.address);
    expect(bodyLines.join('\n')).toContain('Professional Summary');
  });

  it('lifts name, email and phone out of the header', () => {
    const { headerLines } = splitHeaderBlock(CV_WITH_IDENTIFIERS);
    const identity = extractIdentity(headerLines);
    expect(identity.fullName).toBe(IDENTIFIERS.fullName);
    expect(identity.email).toBe(IDENTIFIERS.email);
    expect(identity.phone).toBe(IDENTIFIERS.phone);
  });

  /**
   * The address is none of name, email or phone, and is withheld anyway. The
   * whole header block is presumed identifying — that presumption is what
   * covers the identifiers we did not think to write a pattern for.
   */
  it('withholds the rest of the header rather than forwarding it', () => {
    const { headerLines } = splitHeaderBlock(CV_WITH_IDENTIFIERS);
    const identity = extractIdentity(headerLines);
    expect(identity.otherLines.join(' ')).toContain(IDENTIFIERS.address);
  });

  it('recognises a name and refuses lines that are not one', () => {
    expect(looksLikeName('Thabo Mokoena')).toBe(true);
    expect(looksLikeName('NOMSA DLAMINI')).toBe(true);
    expect(looksLikeName('12 Rissik Street')).toBe(false);
    expect(looksLikeName('thabo.mokoena@example.co.za')).toBe(false);
    expect(looksLikeName('Senior Developer at a national bank in Gauteng')).toBe(
      false,
    );
  });
});

/**
 * Telephone numbers that are not South African.
 *
 * These cases came out of a measurement rather than out of anybody's
 * imagination. Running de-identification across 2483 published resumes left 107
 * telephone numbers standing, and every one of them was North American: ten
 * digits in three-three-four, with no country code for the international
 * pattern to catch.
 *
 * A South African job seeker carries these. A reference at a previous employer
 * abroad, a contact at an international client. The promise on the consent
 * screen says the telephone number is removed, with no clause about which
 * country issued it.
 */
describe('telephone numbers from outside South Africa', () => {
  const scrub = (text: string): string =>
    scrubResidualIdentifiers(text, {
      fullName: null,
      email: null,
      phone: null,
      location: null,
      links: [],
      otherLines: [],
    });

  it('removes the standard North American forms', () => {
    for (const number of ['(217) 097-5477', '304-264-5413', '225 344 8930']) {
      expect(scrub(`Reference: ${number}`)).toContain(PHONE_REDACTION);
      expect(scrub(`Reference: ${number}`)).not.toContain(number);
    }
  });

  /**
   * PDF extraction loses a bracket surprisingly often, and both of these are
   * verbatim from the dataset. A pattern that required brackets to be paired
   * would have walked straight past them.
   */
  it('removes the forms a PDF extractor mangles', () => {
    for (const number of ['(910-432-2392', '865) 336-4800']) {
      expect(scrub(`Call ${number} for details`)).toContain(PHONE_REDACTION);
    }
  });

  /**
   * The guard against the failure the pattern list warns about: a rule loose
   * enough to catch a telephone number can start eating reference numbers.
   * The separator requirement is what holds that line.
   */
  it('leaves numbers that are not telephone numbers alone', () => {
    const safe = [
      'Invoice 1234567890 was settled',
      'Reference 9912310000000 on file',
      'Reduced turnaround from 2019-01-01 to 2020-12-31',
      'Managed a budget of R1 200 000 over three years',
    ];

    for (const text of safe) {
      expect(scrub(text)).toBe(text);
    }
  });
});

describe('deidentify()', () => {
  const result = deidentify(CV_WITH_IDENTIFIERS);

  it('keeps the identifiers on the server', () => {
    expect(result.identity.fullName).toBe(IDENTIFIERS.fullName);
    expect(result.identity.email).toBe(IDENTIFIERS.email);
    expect(result.identity.phone).toBe(IDENTIFIERS.phone);
  });

  it('redacts the ID number and reports it', () => {
    expect(result.redactedIdCount).toBe(1);
    expect(result.content).toContain(ID_REDACTION);
  });

  /**
   * The name and email appear a second time in the experience section. A
   * header-strip alone would forward both, which is why residual scrubbing runs
   * over the body afterwards.
   */
  it('scrubs identifiers that recur below the header', () => {
    expect(result.content).not.toContain(IDENTIFIERS.firstName);
    expect(result.content).not.toContain(IDENTIFIERS.lastName);
    expect(result.content).not.toContain(IDENTIFIERS.email);
  });

  it('keeps the substance of the CV intact', () => {
    expect(result.content).toContain('Java');
    expect(result.content).toContain('PostgreSQL');
    expect(result.content).toContain('Led a team of five engineers');
    expect(result.content).toContain('BSc Computer Science');
  });
});

/**
 * The one that matters.
 */
describe('nothing identifying reaches the AI provider', () => {
  it('sends content containing no name, email, phone or ID number', async () => {
    const provider = new RecordingProvider(MIXED_DRAFT);

    await tailorCv({
      rawCvText: CV_WITH_IDENTIFIERS,
      jobAdvert: JOB_ADVERT,
      provider,
    });

    expect(provider.requests).toHaveLength(1);
    const sent = provider.everythingReceived;

    for (const identifier of [
      IDENTIFIERS.fullName,
      IDENTIFIERS.firstName,
      IDENTIFIERS.lastName,
      IDENTIFIERS.email,
      IDENTIFIERS.phone,
      IDENTIFIERS.idNumber,
      IDENTIFIERS.address,
    ]) {
      expect(sent).not.toContain(identifier);
    }

    // Not just absent as written — absent as digits, too.
    expect(sent.replace(/\D/g, '')).not.toContain(IDENTIFIERS.idNumber);
    expect(sent.replace(/\D/g, '')).not.toContain(IDENTIFIERS.phoneDigits);
  });

  it('still holds the identity server-side for reattachment', async () => {
    const provider = new RecordingProvider(MIXED_DRAFT);
    const outcome = await tailorCv({
      rawCvText: CV_WITH_IDENTIFIERS,
      jobAdvert: JOB_ADVERT,
      provider,
    });

    expect(outcome.identity.fullName).toBe(IDENTIFIERS.fullName);
    expect(outcome.identity.email).toBe(IDENTIFIERS.email);
    expect(outcome.identity.phone).toBe(IDENTIFIERS.phone);
  });

  /**
   * A provider that is never called cannot leak. This asserts the ordering
   * itself: by the time `tailor` runs, de-identification has already happened,
   * because `tailorCv` is the only way to reach the provider.
   */
  it('de-identifies before the provider is called, not after', async () => {
    let contentAtCallTime = '';
    const provider = new RecordingProvider(MIXED_DRAFT);
    const wrapped = {
      async tailor(request: Parameters<typeof provider.tailor>[0]) {
        contentAtCallTime = request.deidentifiedCv;
        return provider.tailor(request);
      },
    };

    await tailorCv({
      rawCvText: CV_WITH_IDENTIFIERS,
      jobAdvert: JOB_ADVERT,
      provider: wrapped,
    });

    expect(contentAtCallTime).not.toContain(IDENTIFIERS.email);
    expect(contentAtCallTime).toContain(ID_REDACTION);
  });
});
