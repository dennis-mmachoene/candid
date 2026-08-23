/**
 * The neutral document model, and the single gate every export passes through.
 *
 * Two jobs:
 *
 *   1. Make the ATS constraints of §9 structural. `DocumentBlock` has no table
 *      variant, no image variant, no column variant. A renderer cannot emit
 *      what the model cannot express, so "no tables in the PDF" stops being a
 *      thing anyone has to remember.
 *
 *   2. Be the only route from a validated draft to a printable document.
 *      `assembleResumeDocument` reads exclusively from the integrity report —
 *      it never touches `draft.skills`. A blocked claim therefore has no path
 *      to a file: not through an approval, not through a crafted request, not
 *      through a future refactor that forgets the rule, because the rule is the
 *      only way through.
 */

import { describePosition, describeQualification } from './validator';
import type {
  ApprovedClaims,
  DocumentBlock,
  DocumentSection,
  IdentityHeader,
  IntegrityReport,
  ResumeDocument,
  SkillGap,
  TailoredDraft,
  ValidatedClaim,
} from './types';

// ---------------------------------------------------------------------------
// ATS constraints
// ---------------------------------------------------------------------------

/**
 * Headings applicant tracking systems reliably recognise. Creative alternatives
 * ("Where I've Been") are the single most common reason a well-written CV
 * parses into empty fields.
 */
export const ATS_SECTION_HEADINGS = {
  summary: 'Professional Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  gaps: 'Development Areas',
} as const;

/**
 * A template may change how the document looks and nothing about what it
 * contains. There is deliberately no field here for columns, borders, rules,
 * background colours, icons or logos — the properties an ATS chokes on are the
 * properties a template cannot set.
 */
export interface TemplateSpec {
  id: string;
  name: string;
  description: string;
  /** One of the standard PDF base-14 fonts, so text stays real and selectable. */
  fontFamily: 'Helvetica' | 'Times-Roman' | 'Courier';
  baseFontSize: number;
  headingFontSize: number;
  nameFontSize: number;
  /** Multiplier on the base font size. */
  lineSpacing: number;
  /** Points of vertical space between sections. */
  sectionSpacing: number;
  headingTransform: 'uppercase' | 'titlecase';
  marginPoints: number;
}

export const TEMPLATES: readonly TemplateSpec[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Serif, generous spacing. Reads well on paper and on screen.',
    fontFamily: 'Times-Roman',
    baseFontSize: 11,
    headingFontSize: 13,
    nameFontSize: 20,
    lineSpacing: 1.35,
    sectionSpacing: 14,
    headingTransform: 'titlecase',
    marginPoints: 56,
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Sans-serif with clear headings. A safe default.',
    fontFamily: 'Helvetica',
    baseFontSize: 11,
    headingFontSize: 12,
    nameFontSize: 19,
    lineSpacing: 1.3,
    sectionSpacing: 13,
    headingTransform: 'uppercase',
    marginPoints: 54,
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Tighter spacing for a longer history on fewer pages.',
    fontFamily: 'Helvetica',
    baseFontSize: 10,
    headingFontSize: 11,
    nameFontSize: 17,
    lineSpacing: 1.15,
    sectionSpacing: 9,
    headingTransform: 'uppercase',
    marginPoints: 42,
  },
];

export function findTemplate(id: string): TemplateSpec {
  return TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[1];
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/** Something left out of the document, and why. Surfaced to the user. */
export interface Omission {
  what: string;
  reason: string;
  verdict: 'blocked' | 'borderline-not-approved';
}

export interface AssemblyResult {
  document: ResumeDocument;
  omissions: readonly Omission[];
}

function includable(
  claim: ValidatedClaim,
  approved: ApprovedClaims,
): boolean {
  if (claim.verdict === 'accepted') return true;
  if (claim.verdict === 'borderline') return approved.has(claim.canonical);
  // 'blocked' — never, regardless of approval state.
  return false;
}

/**
 * Assemble the final document.
 *
 * A bullet is dropped whole if any claim inside it is blocked, or is borderline
 * and unapproved. Editing the offending word out would leave a sentence whose
 * meaning still rests on the claim, so the honest move is to drop the sentence.
 * The same applies to the summary.
 */
export function assembleResumeDocument(input: {
  identity: IdentityHeader;
  draft: TailoredDraft;
  report: IntegrityReport;
  approved: ApprovedClaims;
}): AssemblyResult {
  const { identity, draft, report, approved } = input;
  const omissions: Omission[] = [];

  const all: readonly ValidatedClaim[] = [
    ...report.accepted,
    ...report.borderline,
    ...report.blocked,
  ];

  // --- Skills -------------------------------------------------------------
  // Sourced from the report, never from draft.skills. This is the guarantee.
  const skills: string[] = [];
  const seen = new Set<string>();
  for (const claim of all) {
    if (claim.claim.source !== 'skill') continue;
    if (!includable(claim, approved)) {
      omissions.push({
        what: claim.claim.text,
        reason: claim.reason,
        verdict:
          claim.verdict === 'blocked' ? 'blocked' : 'borderline-not-approved',
      });
      continue;
    }
    if (seen.has(claim.canonical)) continue;
    seen.add(claim.canonical);
    skills.push(claim.claim.text);
  }

  // --- Positions ----------------------------------------------------------
  //
  // A position whose own claim did not survive is dropped entire — the header
  // line and every bullet under it.
  //
  // Keeping the bullets and discarding only the employer line is the tempting
  // half-measure and it is strictly worse than doing nothing. It produces
  // achievements attached to nobody, which is the exact document this product
  // was shipping before positions existed, and a recruiter reads it as
  // concealment.
  const rejectedPositions = new Map<number, ValidatedClaim>();
  const excludedBullets = new Map<string, ValidatedClaim>();

  for (const claim of all) {
    const { source, positionIndex, bulletIndex } = claim.claim;
    if (includable(claim, approved)) continue;

    if (source === 'position' && positionIndex !== undefined) {
      if (!rejectedPositions.has(positionIndex)) {
        rejectedPositions.set(positionIndex, claim);
      }
      continue;
    }
    if (source === 'bullet' && bulletIndex !== undefined) {
      const key = `${positionIndex ?? 0}:${bulletIndex}`;
      if (!excludedBullets.has(key)) excludedBullets.set(key, claim);
    }
  }

  const experienceBlocks: DocumentBlock[] = [];

  draft.positions.forEach((position, positionIndex) => {
    const rejected = rejectedPositions.get(positionIndex);
    if (rejected) {
      omissions.push({
        what: rejected.claim.text,
        reason: `This whole job was left out. ${rejected.reason}`,
        verdict:
          rejected.verdict === 'blocked' ? 'blocked' : 'borderline-not-approved',
      });
      return;
    }

    const bullets: string[] = [];
    position.bullets.forEach((bullet, bulletIndex) => {
      const offending = excludedBullets.get(`${positionIndex}:${bulletIndex}`);
      if (offending) {
        omissions.push({
          what: bullet,
          reason: `Removed because of the claim "${offending.claim.text}". ${offending.reason}`,
          verdict:
            offending.verdict === 'blocked'
              ? 'blocked'
              : 'borderline-not-approved',
        });
        return;
      }
      const text = bullet.trim();
      if (text) bullets.push(text);
    });

    // A record written before structured history has no header line to print.
    // Its bullets are all it ever had, and printing an empty "(  )" above them
    // would be worse than printing nothing.
    const heading = position.legacy ? '' : describePosition(position);
    if (heading) experienceBlocks.push({ kind: 'entry', text: heading });
    if (bullets.length > 0) experienceBlocks.push({ kind: 'bullets', items: bullets });
  });

  // --- Education ----------------------------------------------------------
  const educationBlocks: DocumentBlock[] = [];
  draft.qualifications.forEach((qualification, qualificationIndex) => {
    const rejected = all.find(
      (claim) =>
        claim.claim.source === 'education' &&
        claim.claim.qualificationIndex === qualificationIndex &&
        !includable(claim, approved),
    );
    if (rejected) {
      omissions.push({
        what: rejected.claim.text,
        reason: `This qualification was left out. ${rejected.reason}`,
        verdict:
          rejected.verdict === 'blocked' ? 'blocked' : 'borderline-not-approved',
      });
      return;
    }
    const line = describeQualification(qualification);
    if (line) educationBlocks.push({ kind: 'entry', text: line });
  });

  // --- Summary ------------------------------------------------------------
  const summaryProblem = all.find(
    (claim) => claim.claim.source === 'summary' && !includable(claim, approved),
  );
  let summary = draft.summary.trim();
  if (summaryProblem) {
    omissions.push({
      what: summary,
      reason: `Summary removed because of the claim "${summaryProblem.claim.text}". ${summaryProblem.reason}`,
      verdict:
        summaryProblem.verdict === 'blocked'
          ? 'blocked'
          : 'borderline-not-approved',
    });
    summary = '';
  }

  // --- Sections -----------------------------------------------------------
  const sections: DocumentSection[] = [];

  if (summary) {
    sections.push({
      heading: ATS_SECTION_HEADINGS.summary,
      blocks: [{ kind: 'paragraph', text: summary }],
    });
  }

  if (experienceBlocks.length > 0) {
    sections.push({
      heading: ATS_SECTION_HEADINGS.experience,
      blocks: experienceBlocks,
    });
  }

  // Education sits after experience, which is the convention for anyone past
  // their first job and the order every parser expects.
  if (educationBlocks.length > 0) {
    sections.push({
      heading: ATS_SECTION_HEADINGS.education,
      blocks: educationBlocks,
    });
  }

  if (skills.length > 0) {
    sections.push({
      heading: ATS_SECTION_HEADINGS.skills,
      blocks: [{ kind: 'paragraph', text: skills.join(', ') }],
    });
  }

  return { document: { identity, sections }, omissions };
}

// ---------------------------------------------------------------------------
// Gaps
// ---------------------------------------------------------------------------

/**
 * Gaps are never printed into the exported CV — telling an employer what you
 * cannot do is not the user's job. They are shown in the app so the user knows
 * where they stand and what to learn.
 */
export function gapsForDisplay(
  draft: TailoredDraft,
): readonly SkillGap[] {
  return draft.gaps;
}

// ---------------------------------------------------------------------------
// A last check before rendering
// ---------------------------------------------------------------------------

/**
 * Belt and braces. The type system already rules out tables and images; this
 * catches the residue — control characters from a bad parse, headings a parser
 * will not recognise, empty documents.
 */
export function validateAtsDocument(document: ResumeDocument): readonly string[] {
  const problems: string[] = [];
  const recognised = new Set<string>(Object.values(ATS_SECTION_HEADINGS));

  if (document.sections.length === 0) {
    problems.push('Document has no sections.');
  }

  for (const section of document.sections) {
    if (!recognised.has(section.heading)) {
      problems.push(`Unrecognised section heading: "${section.heading}".`);
    }
    for (const block of section.blocks) {
      const texts =
        block.kind === 'bullets' ? [...block.items] : [block.text];
      for (const text of texts) {
        if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
          problems.push(
            `Control characters in "${section.heading}" would corrupt the export.`,
          );
        }
        if (text.includes('\t')) {
          problems.push(
            `Tab character in "${section.heading}" — tabs are used to fake columns and confuse parsers.`,
          );
        }
      }
    }
  }

  return problems;
}
