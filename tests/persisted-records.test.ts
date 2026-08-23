/**
 * Tests for the database read boundary.
 *
 * These exist because typing the schema in Phase 6 revealed that every read of
 * a `jsonb` column was an unchecked cast. The compiler had been silent only
 * because the Supabase client returned `any`.
 *
 * The dangerous case is not a wildly malformed row — that would throw
 * somewhere obvious. It is a row that is *almost* right: an integrity report
 * missing its `blocked` array reads as "nothing was blocked", and a fabricated
 * claim ends up with no record refusing it.
 */

import { describe, expect, it } from 'vitest';

import {
  CorruptRecordError,
  readApprovals,
  readDraft,
  readReport,
  toJson,
} from '@/lib/infrastructure/persisted-schemas';
import type { Json } from '@/lib/database.types';
import type { IntegrityReport, TailoredDraft } from '@/lib/domain/types';

const DRAFT: TailoredDraft = {
  summary: 'Backend developer with six years of experience.',
  positions: [
    {
      employer: 'Absa Bank',
      title: 'Senior Developer',
      startDate: '2020',
      endDate: 'present',
      bullets: ['Delivered a payments API in Java'],
    },
  ],
  qualifications: [],
  skills: ['Java', 'PostgreSQL'],
  gaps: [{ skill: 'Kubernetes', note: 'Not in your CV.' }],
};

const REPORT: IntegrityReport = {
  accepted: [
    {
      claim: { text: 'Java', kind: 'skill', source: 'skill' },
      verdict: 'accepted',
      canonical: 'java',
      reason: 'This appears in your original CV.',
      evidence: [{ surface: 'Java', line: 'Skills: Java, PostgreSQL' }],
    },
  ],
  borderline: [],
  blocked: [
    {
      claim: { text: 'Kubernetes', kind: 'skill', source: 'skill' },
      verdict: 'blocked',
      canonical: 'kubernetes',
      reason: 'Nothing in your CV supports this.',
      evidence: [],
    },
  ],
};

describe('round trip', () => {
  it('survives being written and read back', () => {
    expect(readDraft(toJson(DRAFT))).toEqual(DRAFT);
    expect(readReport(toJson(REPORT))).toEqual(REPORT);
  });

  /**
   * `toJson` goes through JSON, which also proves what is stored is genuinely
   * serialisable.
   *
   * A `Set` is the case worth catching: it serialises to `{}` rather than to a
   * list, so a skills array built from a Set would land in the column as an
   * empty object and every skill would silently vanish. Under a cast that is
   * discovered months later by a confused user.
   *
   * (A `Date` is *not* caught here, and should not be: it serialises to an ISO
   * string, which is a perfectly valid string field. The first version of this
   * test asserted otherwise and was wrong.)
   */
  it('rejects a value that cannot survive a database column', () => {
    const withSet = {
      summary: 'fine',
      positions: [],
      qualifications: [],
      skills: new Set(['Java', 'PostgreSQL']),
      gaps: [],
    };

    expect(toJson(withSet)).toEqual({
      summary: 'fine',
      positions: [],
      qualifications: [],
      skills: {},
      gaps: [],
    });
    expect(() => readDraft(toJson(withSet))).toThrow(CorruptRecordError);
  });
});

describe('a nearly-right integrity report', () => {
  /**
   * The failure this whole file exists for. Under a cast, a report missing
   * `blocked` reads as "nothing was blocked" — on the one screen where blocked
   * claims are the entire point.
   */
  it('is refused when the blocked array is missing', () => {
    const missingBlocked = {
      accepted: REPORT.accepted,
      borderline: [],
    } as unknown as Json;

    expect(() => readReport(missingBlocked)).toThrow(CorruptRecordError);
  });

  it('is refused when a claim has no verdict', () => {
    const noVerdict = JSON.parse(JSON.stringify(REPORT));
    delete noVerdict.blocked[0].verdict;

    expect(() => readReport(noVerdict as Json)).toThrow(CorruptRecordError);
  });

  it('is refused when a verdict is not one we recognise', () => {
    const invented = JSON.parse(JSON.stringify(REPORT));
    invented.blocked[0].verdict = 'probably-fine';

    expect(() => readReport(invented as Json)).toThrow(CorruptRecordError);
  });

  it('is refused when evidence is missing from a claim', () => {
    const noEvidence = JSON.parse(JSON.stringify(REPORT));
    delete noEvidence.accepted[0].evidence;

    expect(() => readReport(noEvidence as Json)).toThrow(CorruptRecordError);
  });

  it('is refused when it is null, which is what an empty column reads as', () => {
    expect(() => readReport(null)).toThrow(CorruptRecordError);
  });
});

describe('a nearly-right draft', () => {
  it('is refused when gaps are missing', () => {
    const noGaps = {
      summary: '',
      positions: [],
      qualifications: [],
      skills: [],
    } as unknown as Json;
    expect(() => readDraft(noGaps)).toThrow(CorruptRecordError);
  });

  it('is refused when skills are not strings', () => {
    const wrongType = {
      ...DRAFT,
      skills: [{ name: 'Java' }],
    } as unknown as Json;
    expect(() => readDraft(wrongType)).toThrow(CorruptRecordError);
  });
});

describe('approvals fail in the safe direction', () => {
  /**
   * Approvals are the one field where a malformed value can be tolerated,
   * because the failure direction is safe. An empty approvals list can only
   * ever *exclude* content from a document. It cannot include anything.
   */
  it('reads a malformed list as nothing approved', () => {
    expect(readApprovals(null)).toEqual([]);
    expect(readApprovals('not a list' as Json)).toEqual([]);
    expect(readApprovals([1, 2, 3] as Json)).toEqual([]);
  });

  it('reads a valid list as itself', () => {
    expect(readApprovals(['team leadership'] as Json)).toEqual([
      'team leadership',
    ]);
  });
});
