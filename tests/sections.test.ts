/**
 * Sections the model has no field for.
 *
 * A real CV went through Candid and came back missing its Projects and
 * Hackathons section, its coursework and its per-job tech stacks. None of that
 * was refused. The model's reply has five fields and none of them is "project",
 * so the content had nowhere to go and quietly disappeared.
 *
 * The fix copies those sections across in the applicant's own words. These
 * tests use the exact headings and layout from the CV that lost them.
 */

import { describe, expect, it } from 'vitest';

import {
  carriedOverSections,
  isCarriedHeading,
  isConventionalHeading,
  isRebuiltHeading,
  splitIntoSections,
} from '@/lib/domain/sections';

const CV = `Profile
Passionate Full-Stack Developer with a strong foundation in building web applications.
Work Experience
Software Developer & Researcher
Council for Scientific and Industrial Research (CSIR), Pretoria | April 2025 - Present
• Refactored report modules.
Education
Advanced Diploma in Computer Science (Expected 2026)
Skills & Tools
• Back-End: Node.js, C#, Java, Python
Projects & Hackathons
CSIR SCC Student Cluster Competition (2023) — Participant
• Designed and built a high-performance compute cluster prototype using Linux.
• Implemented Zabbix for monitoring and Slurm for workload scheduling.
Certifications
AWS Certified Cloud Practitioner (2025)
Referees
Available on request`;

describe('telling rebuilt sections from carried ones', () => {
  it('knows the headings Candid builds itself', () => {
    for (const heading of [
      'Profile',
      'Work Experience',
      'EDUCATION',
      'Skills & Tools',
      'Technical Skills',
    ]) {
      expect(isRebuiltHeading(heading)).toBe(true);
      expect(isCarriedHeading(heading)).toBe(false);
    }
  });

  it('knows the headings that should travel unchanged', () => {
    for (const heading of [
      'Projects & Hackathons',
      'Certifications',
      'Awards',
      'Publications',
      'Languages',
      'Volunteering',
    ]) {
      expect(isCarriedHeading(heading)).toBe(true);
      expect(isRebuiltHeading(heading)).toBe(false);
    }
  });

  /**
   * An applicant tracking system finds content by looking for headings it
   * knows. An invented one is the single most common reason a good CV parses
   * into empty fields, so it is not carried.
   */
  it('refuses a heading no parser would recognise', () => {
    expect(isConventionalHeading('Where I Have Been')).toBe(false);
    expect(isConventionalHeading('Things I Have Tinkered With')).toBe(false);
    expect(isCarriedHeading('Referees')).toBe(false);
  });

  /** "Projector Repair" is not "Projects". The match falls on a word boundary. */
  it('does not treat a longer word as the heading it begins with', () => {
    expect(isCarriedHeading('Projector Repair')).toBe(false);
  });
});

describe('splitting a CV into sections', () => {
  const sections = splitIntoSections(CV);

  it('finds every recognised heading in order', () => {
    expect(sections.map((section) => section.heading)).toEqual([
      'Profile',
      'Work Experience',
      'Education',
      'Skills & Tools',
      'Projects & Hackathons',
      'Certifications',
    ]);
  });

  it('keeps the applicant heading rather than a normalised one', () => {
    const projects = sections.find((s) => s.heading.startsWith('Projects'));
    expect(projects?.heading).toBe('Projects & Hackathons');
  });

  it('keeps the lines under a heading exactly as written', () => {
    const projects = sections.find((s) => s.heading.startsWith('Projects'));
    expect(projects?.lines).toEqual([
      'CSIR SCC Student Cluster Competition (2023) — Participant',
      '• Designed and built a high-performance compute cluster prototype using Linux.',
      '• Implemented Zabbix for monitoring and Slurm for workload scheduling.',
    ]);
  });
});

describe('what gets carried into the export', () => {
  const carried = carriedOverSections(CV);

  it('carries the sections Candid cannot rebuild, and only those', () => {
    expect(carried.map((section) => section.heading)).toEqual([
      'Projects & Hackathons',
      'Certifications',
    ]);
  });

  /**
   * The specific loss that started this. An advert asked for monitoring
   * experience and the applicant's monitoring work was deleted on the way out.
   */
  it('carries the work that matched the advert and was being thrown away', () => {
    const text = carried.flatMap((section) => section.lines).join('\n');
    expect(text).toContain('Zabbix');
    expect(text).toContain('Slurm');
    expect(text).toContain('high-performance compute cluster');
  });

  it('carries nothing when the CV has no such sections', () => {
    expect(carriedOverSections('Profile\nA developer.\nSkills\nPython')).toEqual([]);
  });

  it('carries nothing rather than a bare heading when a section is empty', () => {
    expect(carriedOverSections('Projects\n\nEducation\nBSc')).toEqual([]);
  });
});
