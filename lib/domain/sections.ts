/**
 * The parts of a CV the tailoring model has no field for.
 *
 * Candid asks the model for a summary, positions, qualifications, skills and
 * gaps. That is the whole shape of its reply. A real CV holds more than that:
 * projects, certifications, awards, publications, languages, volunteering.
 *
 * Those sections were not being refused. They were unrepresentable. There was
 * nowhere in the reply for them to go, so they vanished, and the exported CV
 * was shorter than the one the applicant uploaded. One real document lost a
 * high-performance computing project, with monitoring and scheduling work in
 * it, while being tailored to an advert asking for monitoring experience.
 *
 * These sections are carried straight across instead. Not rewritten, not
 * reordered, not checked: copied, in the applicant's own words. Nothing is
 * generated, so there is nothing to verify. Text that came out of the uploaded
 * CV and went into the exported one unchanged cannot be a fabrication.
 *
 * Only conventional headings are carried. An applicant tracking system reads a
 * CV by looking for headings it knows, so "Projects" travels and "Things I
 * Have Tinkered With" does not. That rule is the same one behind
 * ATS_SECTION_HEADINGS, applied to the sections Candid does not itself build.
 */

/** A run of lines under one heading, exactly as the applicant wrote them. */
export interface CvSection {
  /** The applicant's own heading text, not a normalised version of it. */
  heading: string;
  lines: readonly string[];
}

/**
 * Headings whose content Candid rebuilds from the integrity report. These are
 * already in the exported document, so carrying them again would duplicate
 * them, and carrying them unchecked would bypass the validator entirely.
 */
const REBUILT_HEADINGS: readonly string[] = [
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
  'skills and tools',
  'skills tools',
];

/**
 * Headings an applicant tracking system recognises, which Candid does not
 * build. Content under these is carried across unchanged.
 */
const CARRIED_HEADINGS: readonly string[] = [
  'projects',
  'personal projects',
  'key projects',
  'certifications',
  'certificates',
  'licenses',
  'licences',
  'awards',
  'honours',
  'honors',
  'achievements',
  'accomplishments',
  'publications',
  'research',
  'conferences',
  'presentations',
  'languages',
  'volunteering',
  'volunteer',
  'volunteer experience',
  'community involvement',
  'memberships',
  'affiliations',
  'professional development',
  'courses',
  'training',
  'interests',
  'hobbies',
  'references',
  'extracurricular',
  'leadership',
];

/**
 * Reduce a heading to comparable words.
 *
 * Punctuation is dropped and runs of space collapse, so "Skills & Tools" and
 * "Skills and Tools" and "SKILLS / TOOLS" all arrive at the same place. The
 * ampersand becomes "and" first, because dropping it outright turns "Skills &
 * Tools" into "skills tools" and that is a different phrase to match against.
 */
function normaliseHeading(line: string): string {
  return line
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Does this normalised heading begin with one of `known`?
 *
 * Prefix rather than equality, because real CVs qualify their headings.
 * "Projects & Hackathons", "Work Experience (Selected)" and "Technical Skills
 * and Tools" are all the ordinary section wearing a hat. Requiring the match
 * to fall on a word boundary keeps "Projector Repair" from reading as
 * "Projects".
 */
function startsWithKnown(normalised: string, known: readonly string[]): boolean {
  return known.some(
    (heading) =>
      normalised === heading || normalised.startsWith(`${heading} `),
  );
}

/** Is this line a heading Candid already rebuilds from the report? */
export function isRebuiltHeading(line: string): boolean {
  const normalised = normaliseHeading(line);
  if (!normalised || normalised.length > 60) return false;
  return startsWithKnown(normalised, REBUILT_HEADINGS);
}

/** Is this line a conventional heading whose content should travel as written? */
export function isCarriedHeading(line: string): boolean {
  const normalised = normaliseHeading(line);
  if (!normalised || normalised.length > 60) return false;
  return startsWithKnown(normalised, CARRIED_HEADINGS);
}

/**
 * Is this a heading an applicant tracking system will recognise?
 *
 * Used by the export check, which otherwise only knows the five headings
 * Candid writes itself and would reject a carried section as unrecognised.
 */
export function isConventionalHeading(line: string): boolean {
  return isRebuiltHeading(line) || isCarriedHeading(line);
}

/**
 * Split a CV into sections at every heading it recognises.
 *
 * Anything before the first heading is dropped. In de-identified text that is
 * whatever remained of the header block, which is not wanted here.
 */
export function splitIntoSections(text: string): readonly CvSection[] {
  const lines = text.split('\n');
  const sections: CvSection[] = [];
  let current: { heading: string; lines: string[] } | null = null;

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (isConventionalHeading(line.trim())) {
      if (current) sections.push({ heading: current.heading, lines: current.lines });
      current = { heading: line.trim(), lines: [] };
      continue;
    }

    if (current) current.lines.push(line);
  }

  if (current) sections.push({ heading: current.heading, lines: current.lines });

  return sections.map((section) => ({
    heading: section.heading,
    // Trailing blank lines are an artefact of where the next heading fell.
    lines: trimBlankEdges(section.lines),
  }));
}

function trimBlankEdges(lines: readonly string[]): readonly string[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === '') start += 1;
  while (end > start && lines[end - 1].trim() === '') end -= 1;
  return lines.slice(start, end);
}

/**
 * The sections to copy into the exported CV untouched.
 *
 * Empty sections are dropped: a heading with nothing under it is a parsing
 * artefact, and printing it would add a bare word to the page.
 */
export function carriedOverSections(cvText: string): readonly CvSection[] {
  return splitIntoSections(cvText).filter(
    (section) => isCarriedHeading(section.heading) && section.lines.length > 0,
  );
}
