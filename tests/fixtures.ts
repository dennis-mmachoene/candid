import type { AIProvider, TailorRequest } from '@/lib/domain/ports';
import type { TailoredDraft } from '@/lib/domain/types';

/**
 * A CV carrying every kind of identifier the product promises to protect:
 * a name (repeated in the body, where a naive header-strip would miss it),
 * an email, a South African mobile number, a street address, and a valid
 * South African ID number sitting well below the header block.
 */
export const CV_WITH_IDENTIFIERS = `Thabo Mokoena
thabo.mokoena@example.co.za
+27 82 555 0134
12 Rissik Street, Braamfontein, Johannesburg 2001

Professional Summary
Backend developer with six years building payment systems in Java and PostgreSQL.

Experience
Senior Developer, Absa Bank (2020 - present)
- Led a team of five engineers delivering a payments API in Java and PostgreSQL
- Reduced settlement turnaround time by 40% by automating the reconciliation process
- References available from Thabo Mokoena on thabo.mokoena@example.co.za

Skills
Java, PostgreSQL, Docker, JS, Git

Education
BSc Computer Science, University of Pretoria (2017)

Personal Details
ID Number: 8001015009087
Nationality: South African`;

export const IDENTIFIERS = {
  fullName: 'Thabo Mokoena',
  firstName: 'Thabo',
  lastName: 'Mokoena',
  email: 'thabo.mokoena@example.co.za',
  phone: '+27 82 555 0134',
  phoneDigits: '27825550134',
  idNumber: '8001015009087',
  address: '12 Rissik Street',
} as const;

/** A valid SA ID: date 1980-01-01, Luhn check digit 7. */
export const VALID_SA_ID = '8001015009087';
/** Same digits with the check digit changed — Luhn must reject it. */
export const INVALID_CHECKSUM_ID = '8001015009084';
/**
 * Month 19, but with a *correct* Luhn check digit. This is the fixture that
 * proves the date test is doing work of its own rather than riding on the
 * checksum.
 */
export const IMPOSSIBLE_DATE_ID = '8019015009089';

/**
 * A draft containing, deliberately, one of each: a claim that traces straight
 * to the CV, the same claim under a different spelling, a fair inference, and
 * a pure invention.
 */
export const MIXED_DRAFT: TailoredDraft = {
  summary:
    'Backend developer with six years building payment systems for financial services.',
  bullets: [
    'Delivered a payments API in Java and PostgreSQL for a national bank',
    'Orchestrated container deployments with Kubernetes across three regions',
    'Reduced settlement turnaround time by 40% through automation',
  ],
  skills: ['PostgreSQL', 'Postgres', 'team leadership', 'Kubernetes'],
  gaps: [
    {
      skill: 'Kubernetes',
      note: 'The advert asks for container orchestration and your CV does not mention it.',
    },
  ],
};

/**
 * Records the request it was handed so a test can assert on the exact payload
 * that would have crossed the network.
 */
export class RecordingProvider implements AIProvider {
  public readonly requests: TailorRequest[] = [];

  constructor(private readonly reply: TailoredDraft) {}

  async tailor(request: TailorRequest): Promise<TailoredDraft> {
    this.requests.push(request);
    return this.reply;
  }

  /** Everything this provider was ever given, as one string. */
  get everythingReceived(): string {
    return this.requests
      .map((r) => `${r.deidentifiedCv}\n${r.jobAdvert}`)
      .join('\n');
  }
}

export const JOB_ADVERT = `Senior Backend Engineer, Cape Town.
We are looking for someone strong in Java, PostgreSQL and Kubernetes,
who has led a small team and can own a service end to end.`;
