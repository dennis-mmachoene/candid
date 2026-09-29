/**
 * The name inside the web address.
 *
 * A real export came back carrying this line:
 *
 *   GitHub: github.com/[NAME REDACTED]-[NAME REDACTED]/smart-crops-solutions
 *
 * Nothing malfunctioned. The residual scrub removes the applicant's name from
 * the body of the CV, case-insensitively, on word boundaries, and that is
 * exactly what it did. The address simply should not have been there for it to
 * find — a URL is not prose, and taking words out of the middle of one produces
 * something worse than either keeping it or dropping it.
 *
 * So links are lifted out before the scrub runs and put back at export, the
 * same treatment the name, the phone number and the location already get.
 *
 * These tests use the real CV that produced the defect.
 */

import { describe, expect, it } from 'vitest';

import {
  deidentify,
  extractHeadline,
  linkMarker,
  restoreLinks,
  withholdLinks,
} from '@/lib/domain/identity';
import { assembleResumeDocument } from '@/lib/domain/resume-document';
import type { IdentityHeader, IntegrityReport, TailoredDraft } from '@/lib/domain/types';

const GITHUB = 'https://github.com/dennis-mmachoene/smart-crops-solutions';

const CV = `Dennis Mmachoene Ramara
Full-Stack Developer
dennism.ramara@gmail.com | (+27) 60-946-8143 | Pretoria, Gauteng

Profile
Full-stack developer with a foundation in building web applications.

Projects & Hackathons
2nd Annual Mpumalanga AI Student Hackathon (MAISH 2024) - Mentor, Team Lead
• Led the development of Smart Crops Solution.
• GitHub: ${GITHUB}
`;

describe('a web address in the body of a CV', () => {
  const { identity, content } = deidentify(CV);

  it('is not sent to the model', () => {
    expect(content).not.toContain('github.com');
    expect(content).toContain(linkMarker(identity.links.indexOf(GITHUB)));
  });

  /** The defect, stated as an assertion. */
  it('does not come back with the name cut out of it', () => {
    expect(content).not.toContain('[NAME REDACTED]-[NAME REDACTED]');
    expect(content).not.toMatch(/github\.com\/\[NAME/);
  });

  it('is kept, so the export still has it', () => {
    expect(identity.links).toContain(GITHUB);
  });

  it('comes back character for character', () => {
    expect(restoreLinks(content, identity.links)).toContain(GITHUB);
  });

  /**
   * The rest of the scrub is untouched. Widening what is lifted out before it
   * runs must not narrow what it removes.
   */
  it('does not weaken the identity guarantee around it', () => {
    expect(content).not.toContain('Dennis');
    expect(content).not.toContain('Ramara');
    expect(content).not.toContain('dennism.ramara@gmail.com');
    expect(content).not.toContain('60-946-8143');
  });
});

describe('numbering the markers', () => {
  it('gives one address one marker however it is spelled', () => {
    const { text, links } = withholdLinks(
      'See https://github.com/x/y and also github.com/x/y again.',
      [],
    );
    expect(links).toHaveLength(1);
    expect(text).toBe('See [LINK 1] and also [LINK 1] again.');
  });

  it('reuses the number a header link already has', () => {
    const { text, links } = withholdLinks('Portfolio at www.github.com/x/y.', [
      'https://linkedin.com/in/someone',
      'https://github.com/x/y',
    ]);
    expect(links).toHaveLength(2);
    expect(text).toBe('Portfolio at [LINK 2].');
  });

  it('leaves the punctuation that followed the address', () => {
    const { text } = withholdLinks('Repo (https://github.com/x/y), archived.', []);
    expect(text).toBe('Repo ([LINK 1]), archived.');
  });

  /**
   * The bare-domain branch is the risky one. A pattern that took any dotted
   * word followed by a slash would eat half of every skills line in the
   * country.
   */
  it('does not mistake ordinary CV text for an address', () => {
    const line = 'Node.js/React, Agile/Scrum, CI/CD, UI/UX, C#/.NET';
    expect(withholdLinks(line, []).links).toEqual([]);
    expect(withholdLinks(line, []).text).toBe(line);
  });

  it('still catches an address whose scheme the parser dropped', () => {
    const { links } = withholdLinks('linkedin.com/in/dennis-ramara', []);
    expect(links).toEqual(['linkedin.com/in/dennis-ramara']);
  });
});

describe('putting the addresses back', () => {
  it('leaves a marker alone when there is no link for it', () => {
    expect(restoreLinks('see [LINK 4]', ['https://github.com/x/y'])).toBe(
      'see [LINK 4]',
    );
  });

  it('changes nothing when there were never any links', () => {
    expect(restoreLinks('no links here', [])).toBe('no links here');
  });
});

describe('the title under the name', () => {
  it('is kept rather than withheld with the address', () => {
    expect(deidentify(CV).identity.headline).toBe('Full-Stack Developer');
  });

  it('is not taken from a line carrying contact details', () => {
    expect(
      extractHeadline(['Naledi Sithole', 'naledi@example.co.za'], 'Naledi Sithole'),
    ).toBeNull();
  });

  it('is not a street address', () => {
    expect(
      extractHeadline(['Naledi Sithole', '47 Church Street'], 'Naledi Sithole'),
    ).toBeNull();
  });

  it('is absent when the CV does not have one', () => {
    expect(extractHeadline(['Naledi Sithole'], 'Naledi Sithole')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// End to end, through the document the user actually downloads
// ---------------------------------------------------------------------------

const EMPTY_DRAFT: TailoredDraft = {
  summary: '',
  positions: [],
  qualifications: [],
  skills: [],
  gaps: [],
};

const EMPTY_REPORT: IntegrityReport = {
  accepted: [],
  borderline: [],
  blocked: [],
};

describe('the exported document', () => {
  const { identity, content } = deidentify(CV);

  const { document } = assembleResumeDocument({
    identity: identity as IdentityHeader,
    draft: EMPTY_DRAFT,
    report: EMPTY_REPORT,
    approved: new Set<string>(),
    sourceCv: content,
  });

  const text = document.sections
    .flatMap((section) =>
      section.blocks.flatMap((block) =>
        block.kind === 'bullets' ? [...block.items] : [block.text],
      ),
    )
    .join('\n');

  it('carries the projects section across, as before', () => {
    expect(text).toContain('Smart Crops Solution');
  });

  /** The line the applicant would have had to fix by hand. */
  it('prints the real address in it', () => {
    expect(text).toContain(GITHUB);
    expect(text).not.toContain('[LINK 1]');
    expect(text).not.toContain('[NAME REDACTED]');
  });
});
