/**
 * Proof of Guarantee 2 — Candid never fabricates experience.
 *
 * The draft under test contains, by construction, one claim that traces
 * straight to the CV, the same claim under a different spelling, a fair
 * inference, and a pure invention. The tests assert the verdicts, then assert
 * the thing that actually protects the user: that the invention cannot reach a
 * document no matter what is clicked.
 */

import { describe, expect, it } from 'vitest';

import { buildInventory, canonicalise, inventoryHas } from '@/lib/domain/inventory';
import { deidentify } from '@/lib/domain/identity';
import { assembleResumeDocument } from '@/lib/domain/resume-document';
import { checkEvidence, namedInFull } from '@/lib/domain/provenance';
import { extractClaims, reviewDraft, validateClaim } from '@/lib/domain/validator';
import type { ApprovedClaims, IdentityHeader, ValidatedClaim } from '@/lib/domain/types';
import { CV_WITH_IDENTIFIERS, MIXED_DRAFT } from './fixtures';

const { identity, content } = deidentify(CV_WITH_IDENTIFIERS);
const inventory = buildInventory(content);
const report = reviewDraft(MIXED_DRAFT, inventory);

function skillClaim(text: string): ValidatedClaim | undefined {
  const all = [...report.accepted, ...report.borderline, ...report.blocked];
  return all.find(
    (v) => v.claim.source === 'skill' && v.claim.text === text,
  );
}

function documentText(approved: ApprovedClaims): string {
  const { document } = assembleResumeDocument({
    identity,
    draft: MIXED_DRAFT,
    report,
    approved,
  });
  return JSON.stringify(document);
}

const NOTHING_APPROVED: ApprovedClaims = new Set<string>();

describe('the skill inventory', () => {
  it('captures what the user listed', () => {
    expect(inventoryHas(inventory, 'Java')).toBe(true);
    expect(inventoryHas(inventory, 'PostgreSQL')).toBe(true);
    expect(inventoryHas(inventory, 'Docker')).toBe(true);
  });

  it('treats recognised spellings of one competency as the same thing', () => {
    expect(canonicalise('Postgres')).toBe(canonicalise('PostgreSQL'));
    expect(canonicalise('JS')).toBe('javascript');
    expect(inventoryHas(inventory, 'Postgres')).toBe(true);
  });

  /**
   * The alias map is the obvious place to smuggle a fabrication in. Mapping
   * React to React Native, or Java to JavaScript, would let the model claim a
   * competency the user never had while the validator waved it through.
   */
  it('does not treat different competencies as equivalent', () => {
    expect(canonicalise('Java')).not.toBe(canonicalise('JavaScript'));
    expect(canonicalise('React')).not.toBe(canonicalise('React Native'));
    expect(canonicalise('SQL')).not.toBe(canonicalise('PostgreSQL'));
    expect(inventoryHas(inventory, 'JavaScript')).toBe(true); // the CV lists JS
    expect(inventoryHas(inventory, 'Kubernetes')).toBe(false);
  });

  it('does not invent skills out of prose fragments', () => {
    const small = buildInventory('I have excellent attention to detail.');
    expect(inventoryHas(small, 'TypeScript')).toBe(false);
    expect(inventoryHas(small, 'Go')).toBe(false);
  });
});

describe('verdicts', () => {
  it('accepts a claim that traces directly to the CV', () => {
    const claim = skillClaim('PostgreSQL');
    expect(claim?.verdict).toBe('accepted');
    expect(claim?.evidence.length).toBeGreaterThan(0);
  });

  it('accepts the same claim written a different way', () => {
    expect(skillClaim('Postgres')?.verdict).toBe('accepted');
  });

  it('marks a fair inference borderline, and shows what it came from', () => {
    const claim = skillClaim('team leadership');
    expect(claim?.verdict).toBe('borderline');
    expect(claim?.evidence.map((e) => e.line).join(' ')).toContain(
      'Led a team of five engineers',
    );
    expect(claim?.reason).toMatch(/leading or managing people/i);
  });

  it('blocks a claim with no trace at all', () => {
    const claim = skillClaim('Kubernetes');
    expect(claim?.verdict).toBe('blocked');
    expect(claim?.evidence).toHaveLength(0);
  });

  /**
   * An unrecognised claim is refused, not waved through. The fallthrough being
   * `blocked` rather than `accepted` is the difference between a rule that
   * fails safe and one that fails open.
   */
  it('blocks anything the rule does not understand', () => {
    const verdict = validateClaim(
      { text: 'quantum cryptography', kind: 'skill', source: 'skill' },
      inventory,
    );
    expect(verdict.verdict).toBe('blocked');
  });

  it('judges claims buried in bullets, not only the skills list', () => {
    const claims = extractClaims(MIXED_DRAFT);
    const inBullet = claims.filter(
      (c) => c.source === 'bullet' && c.text.toLowerCase() === 'kubernetes',
    );
    expect(inBullet).toHaveLength(1);
    expect(report.blocked.some((v) => v.claim.source === 'bullet')).toBe(true);
  });
});

describe('what reaches the document', () => {
  it('never includes a blocked claim', () => {
    expect(documentText(NOTHING_APPROVED)).not.toContain('Kubernetes');
  });

  /**
   * The claim this product makes is not "we usually exclude fabrications" but
   * "a blocked claim can never reach an exported file regardless of what the
   * user clicks". Approving it explicitly must still fail.
   */
  it('still excludes a blocked claim when it has been approved', () => {
    const approved: ApprovedClaims = new Set(['kubernetes']);
    expect(documentText(approved)).not.toContain('Kubernetes');
  });

  it('drops the whole bullet that carried the blocked claim', () => {
    const { document, omissions } = assembleResumeDocument({
      identity,
      draft: MIXED_DRAFT,
      report,
      approved: NOTHING_APPROVED,
    });
    const text = JSON.stringify(document);
    expect(text).not.toContain('Orchestrated container deployments');
    expect(text).toContain('Delivered a payments API');
    expect(omissions.some((o) => o.verdict === 'blocked')).toBe(true);
  });

  it('omits a borderline claim until it is approved', () => {
    expect(documentText(NOTHING_APPROVED)).not.toContain('team leadership');
  });

  it('includes a borderline claim once it is approved', () => {
    const approved: ApprovedClaims = new Set(['team leadership']);
    expect(documentText(approved)).toContain('team leadership');
  });

  it('keeps accepted claims, without duplicating the aliases', () => {
    const { document } = assembleResumeDocument({
      identity,
      draft: MIXED_DRAFT,
      report,
      approved: NOTHING_APPROVED,
    });
    const skills = document.sections.find((s) => s.heading === 'Skills');
    const text = JSON.stringify(skills);
    expect(text).toContain('PostgreSQL');
    expect(text).not.toContain('Postgres,');
  });

  it('explains every omission to the user', () => {
    const { omissions } = assembleResumeDocument({
      identity,
      draft: MIXED_DRAFT,
      report,
      approved: NOTHING_APPROVED,
    });
    expect(omissions.length).toBeGreaterThan(0);
    for (const omission of omissions) {
      expect(omission.reason.length).toBeGreaterThan(10);
    }
  });

  it('reattaches the identity that was withheld from the model', () => {
    const { document } = assembleResumeDocument({
      identity,
      draft: MIXED_DRAFT,
      report,
      approved: NOTHING_APPROVED,
    });
    const reattached: IdentityHeader = document.identity;
    expect(reattached.fullName).toBe('Thabo Mokoena');
  });
});

/**
 * Employer names across a line break.
 *
 * These came out of a real CV, not out of imagination. Candid deleted both of
 * this person's jobs and told them "Your CV does not name this organisation"
 * about employers printed plainly on the page. The cause was that the whole
 * name test treated a newline as an ordinary space, so the last word of the
 * job title on the line above looked like the first word of the company name.
 *
 * Every CV that puts the title above the employer hit this, which is most of
 * them. The measurement that found it ran the real product against a real
 * document; no fixture we had written happened to use that layout.
 */
describe('an employer named on its own line', () => {
  const csir =
    'Software Developer & Researcher\nCouncil for Scientific and Industrial Research (CSIR), Pretoria, South Africa | April 2025 - Present';

  it('is recognised when the title sits on the line above', () => {
    expect(
      namedInFull(csir, 'Council for Scientific and Industrial Research (CSIR)'),
    ).toBe(true);
  });

  it('is recognised when the line above ends in another capitalised word', () => {
    const icep =
      'Backend Developer | Full Stack Developer | Scrum Master\nInformatic and Community Engagement Projects (ICEP), Mpumalanga, South Africa | June 2024 - June 2025';
    expect(
      namedInFull(icep, 'Informatic and Community Engagement Projects (ICEP)'),
    ).toBe(true);
  });

  /**
   * The rule this function exists for has to survive the fix. Within a single
   * line, a capitalised word either side still extends the name, so a fragment
   * is still a fragment.
   */
  it('still refuses a fragment of a longer name on the same line', () => {
    expect(namedInFull('Absa Bank Limited paid the invoice', 'Bank')).toBe(false);
    expect(namedInFull('I worked at Standard Bank Group', 'Standard')).toBe(false);
  });

  /*
   * The legal-suffix case belongs to sameOrganisation, not to namedInFull.
   *
   * namedInFull refuses "Absa Bank" inside "Absa Bank Limited" on purpose,
   * because "Limited" extends the name. sameOrganisation is what strips the
   * suffix and retries, and checkEvidence is the exported way to reach it. An
   * earlier version of this test asserted the wrong function and failed; the
   * code was right.
   */
  it('accepts an employer the CV writes out with a legal suffix', () => {
    const quote =
      'Senior Analyst\nAbsa Bank Limited, Johannesburg | 2019 - 2022';
    const source = `Work Experience\n${quote}\nBuilt reporting tools.`;

    const check = checkEvidence(
      {
        evidence: quote,
        organisation: 'Absa Bank',
        label: 'Senior Analyst',
        dates: ['2019', '2022'],
      },
      source,
    );

    expect(check.quoteFound).toBe(true);
    expect(check.employerInQuote).toBe(true);
  });

  /*
   * The whole failure, end to end, at the point the product actually uses.
   * This is the case that shipped a CV with no work history on it.
   */
  it('traces a real job whose employer sits below its title', () => {
    const quote =
      'Software Developer & Researcher\nCouncil for Scientific and Industrial Research (CSIR), Pretoria, South Africa | April 2025 - Present';
    const source = `Work Experience\n${quote}\n- Refactored report modules.`;

    const check = checkEvidence(
      {
        evidence: quote,
        organisation: 'Council for Scientific and Industrial Research (CSIR)',
        label: 'Software Developer & Researcher',
        dates: ['April 2025', 'Present'],
      },
      source,
    );

    expect(check.quoteFound).toBe(true);
    expect(check.employerInQuote).toBe(true);
    expect(check.titleInQuote).toBe(true);
    expect(check.untracedDates).toEqual([]);
  });

  /**
   * A line break separates, but it must not invent a match that is not there.
   */
  it('does not match an organisation the text never names', () => {
    expect(namedInFull(csir, 'University of Pretoria')).toBe(false);
    expect(namedInFull(csir, 'Eskom')).toBe(false);
  });
});
