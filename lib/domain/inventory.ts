/**
 * The skill inventory — the record of what the user can actually back up.
 *
 * Everything the anti-fabrication rule does is measured against this structure,
 * so its correctness matters more than almost anything else in the codebase. It
 * is built only from the user's own CV; the job advert never contributes to it.
 *
 * Two failure modes pull in opposite directions:
 *
 *   - Too *narrow* an inventory blocks skills the user genuinely has, and the
 *     product becomes annoying.
 *   - Too *broad* an inventory admits skills the user never claimed, and the
 *     product becomes dishonest.
 *
 * The second is the one that breaks the guarantee, so where the two conflict
 * this file errs narrow.
 */

import type { SkillEvidence, SkillInventory } from './types';

/**
 * Terms this short are only trusted when they appear as a discrete entry in a
 * skills list. Scanning prose for "ts" or "go" or "r" produces false positives,
 * and a false positive here is a fabrication loophole: it would let a model
 * claim TypeScript because the CV contained the word "its".
 */
const MIN_FREE_TEXT_TERM_LENGTH = 4;

// ---------------------------------------------------------------------------
// Aliases
// ---------------------------------------------------------------------------

/**
 * Canonical name -> spellings that mean the same competency.
 *
 * The bar for adding an entry: would a fair-minded recruiter agree these are
 * the same thing, such that writing one when the CV says the other is honest?
 *
 * "js" and "JavaScript" clear that bar. "React" and "React Native" do not, and
 * are deliberately absent — mobile development is a different competency, and
 * mapping one to the other would be fabrication wearing an alias map's clothes.
 * The same reasoning keeps Java and JavaScript, SQL and PostgreSQL, and C and
 * C++ separate.
 */
export const SKILL_ALIASES: Readonly<Record<string, readonly string[]>> = {
  javascript: ['js', 'ecmascript', 'java script', 'vanilla javascript'],
  typescript: ['ts'],
  postgresql: ['postgres', 'psql', 'postgre sql', 'postgresql database'],
  'microsoft sql server': ['mssql', 'sql server', 't sql', 'tsql'],
  mysql: ['my sql'],
  mongodb: ['mongo'],
  python: ['python3', 'python 3'],
  'c#': ['c sharp', 'csharp'],
  'c++': ['cpp', 'c plus plus'],
  kubernetes: ['k8s'],
  docker: ['containerisation', 'containerization'],
  'amazon web services': ['aws'],
  'microsoft azure': ['azure'],
  'google cloud platform': ['gcp', 'google cloud'],
  'ci/cd': ['cicd', 'ci cd', 'continuous integration', 'continuous delivery'],
  'rest apis': ['rest', 'restful', 'restful apis', 'rest api', 'api development'],
  'user interface design': ['ui design', 'ui'],
  'user experience design': ['ux design', 'ux'],
  'search engine optimisation': ['seo', 'search engine optimization'],
  'microsoft excel': ['excel', 'ms excel', 'advanced excel'],
  'microsoft word': ['word', 'ms word'],
  'microsoft powerpoint': ['powerpoint', 'ms powerpoint'],
  'agile methodologies': ['agile', 'scrum', 'kanban', 'agile delivery'],
  'version control': ['git', 'github', 'gitlab', 'source control'],
  'data analysis': ['data analytics', 'analytics'],
  'machine learning': ['ml'],
  'natural language processing': ['nlp'],
  'human resources': ['hr'],
  'customer relationship management': ['crm'],
  accounting: ['bookkeeping'],
  'financial reporting': ['financial reports', 'management accounts'],
  'project management': ['project delivery', 'programme management'],
  'stakeholder management': ['stakeholder engagement'],
  'team leadership': ['team lead', 'people management', 'line management'],
  'public speaking': ['presentation skills', 'presenting'],
  'technical writing': ['documentation'],
  'quality assurance': ['qa', 'quality control'],
  'business analysis': ['business analyst'],
  'supply chain management': ['supply chain', 'logistics'],
  'occupational health and safety': ['ohs', 'health and safety'],
};

/** alias -> canonical, built once from SKILL_ALIASES. */
const ALIAS_TO_CANONICAL: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    map.set(canonical, canonical);
    for (const alias of aliases) map.set(alias, canonical);
  }
  return map;
})();

/**
 * Skill terms recognised in free prose. Anything a user lists explicitly in a
 * skills section is captured regardless of whether it appears here — this list
 * exists so that a skill only *demonstrated* in an experience bullet ("built
 * reporting dashboards in Power BI") still lands in the inventory.
 */
const FREE_TEXT_VOCABULARY: readonly string[] = [
  ...Object.keys(SKILL_ALIASES),
  ...Object.values(SKILL_ALIASES).flat(),
  'react',
  'angular',
  'vue',
  'svelte',
  'next.js',
  'node.js',
  'express',
  'django',
  'flask',
  'laravel',
  'spring boot',
  'java',
  'php',
  'ruby',
  'rails',
  'swift',
  'kotlin',
  'flutter',
  'tailwind',
  'bootstrap',
  'html',
  'css',
  'sass',
  'sql',
  'redis',
  'graphql',
  'firebase',
  'supabase',
  'terraform',
  'jenkins',
  'linux',
  'bash',
  'power bi',
  'tableau',
  'looker',
  'pandas',
  'numpy',
  'tensorflow',
  'pytorch',
  'sage',
  'pastel',
  'quickbooks',
  'sap',
  'salesforce',
  'hubspot',
  'jira',
  'confluence',
  'figma',
  'adobe photoshop',
  'adobe illustrator',
  'indesign',
  'autocad',
  'solidworks',
  'matlab',
  'stata',
  'spss',
  'payroll',
  'budgeting',
  'forecasting',
  'auditing',
  'taxation',
  'recruitment',
  'onboarding',
  'training',
  'mentoring',
  'coaching',
  'negotiation',
  'procurement',
  'inventory management',
  'merchandising',
  'copywriting',
  'content marketing',
  'social media marketing',
  'email marketing',
  'market research',
  'customer service',
  'call centre',
  'teaching',
  'curriculum development',
  'nursing',
  'patient care',
  'phlebotomy',
  'first aid',
  'welding',
  'plumbing',
  'electrical installation',
  'fleet management',
  'warehouse management',
  'forklift operation',
];

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/**
 * Reduce a written skill to a comparable form: lowercase, no surrounding
 * punctuation or list markers, no parenthetical qualifier, no trailing version
 * number ("React 18" and "React" are the same competency).
 */
export function normaliseTerm(term: string): string {
  return term
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[•·▪◦*‐-―]/g, ' ')
    .replace(/\s+v?\d+(\.\d+)*\s*$/, '')
    .replace(/[^a-z0-9+#./\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-.\s]+|[-.\s]+$/g, '');
}

/** Normalise, then resolve through the alias map to a canonical key. */
export function canonicalise(term: string): string {
  const normalised = normaliseTerm(term);
  return ALIAS_TO_CANONICAL.get(normalised) ?? normalised;
}

// ---------------------------------------------------------------------------
// Skills-section extraction
// ---------------------------------------------------------------------------

const SKILLS_HEADING =
  /^\s*(technical\s+|key\s+|core\s+|professional\s+|other\s+|soft\s+|hard\s+|it\s+|computer\s+)?(skills?|competenc(?:y|ies)|technologies|tools|proficiencies|expertise)\s*:?\s*$/i;

/** Inline form: "Skills: React, TypeScript, SQL". */
const INLINE_SKILLS_HEADING =
  /^\s*(technical\s+|key\s+|core\s+|professional\s+|other\s+|soft\s+|hard\s+|it\s+|computer\s+)?(skills?|competenc(?:y|ies)|technologies|tools|proficiencies|expertise)\s*:\s*(.+)$/i;

const OTHER_HEADING =
  /^\s*(profile|summary|objective|experience|work experience|professional experience|employment(\s+history)?|work history|education|qualifications|certifications?|projects?|achievements?|references?|languages|interests|volunteer(ing)?|publications|awards)\s*:?\s*$/i;

const ENTRY_SEPARATOR = /[,;|/•·]|\s{3,}|\s+[-–—]\s+/;

/**
 * Pull discrete entries out of a CV's skills section(s).
 *
 * These are trusted more than prose matches: a term the user typed into their
 * own skills list is a first-person claim, so short terms ("Go", "R", "TS")
 * count here even though they are ignored in free text.
 */
export function extractSkillsSectionEntries(
  lines: readonly string[],
): { surface: string; line: string }[] {
  const entries: { surface: string; line: string }[] = [];
  let inSkills = false;

  for (const line of lines) {
    const inline = INLINE_SKILLS_HEADING.exec(line);
    if (inline) {
      for (const part of inline[3].split(ENTRY_SEPARATOR)) {
        const surface = part.trim();
        if (surface) entries.push({ surface, line: line.trim() });
      }
      inSkills = false;
      continue;
    }

    if (SKILLS_HEADING.test(line)) {
      inSkills = true;
      continue;
    }

    if (inSkills) {
      if (OTHER_HEADING.test(line)) {
        inSkills = false;
        continue;
      }
      if (!line.trim()) continue;

      for (const part of line.split(ENTRY_SEPARATOR)) {
        const surface = part.trim().replace(/^[-•·*\s]+/, '');
        if (surface && surface.length <= 60) {
          entries.push({ surface, line: line.trim() });
        }
      }
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Building the inventory
// ---------------------------------------------------------------------------

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build the verifiable inventory from the original CV.
 *
 * Sources, in order of trust:
 *   1. Entries the user listed in a skills section — first-person claims.
 *   2. Vocabulary terms appearing anywhere in the CV, if long enough to match
 *      unambiguously.
 *
 * Every entry carries the line it came from, so the review UI can show the user
 * exactly why a claim was accepted.
 */
export function buildInventory(cvText: string): SkillInventory {
  const lines = cvText.split(/\r?\n/);
  const canonical = new Set<string>();
  const evidence = new Map<string, SkillEvidence[]>();

  const record = (key: string, item: SkillEvidence): void => {
    if (!key) return;
    canonical.add(key);
    const existing = evidence.get(key);
    if (!existing) {
      evidence.set(key, [item]);
    } else if (!existing.some((e) => e.line === item.line)) {
      existing.push(item);
    }
  };

  for (const entry of extractSkillsSectionEntries(lines)) {
    record(canonicalise(entry.surface), {
      surface: entry.surface,
      line: entry.line,
    });
  }

  const lowerLines = lines.map((line) => line.toLowerCase());
  for (const term of FREE_TEXT_VOCABULARY) {
    if (term.length < MIN_FREE_TEXT_TERM_LENGTH) continue;
    const pattern = new RegExp(`(?<![a-z0-9])${escapeRegExp(term)}(?![a-z0-9])`, 'i');
    for (let i = 0; i < lowerLines.length; i += 1) {
      if (pattern.test(lowerLines[i])) {
        record(canonicalise(term), { surface: term, line: lines[i].trim() });
      }
    }
  }

  return {
    canonical,
    evidence,
    normalisedText: cvText.toLowerCase().replace(/\s+/g, ' '),
    lines,
  };
}

/** True when the inventory contains this claim under any recognised spelling. */
export function inventoryHas(
  inventory: SkillInventory,
  term: string,
): boolean {
  return inventory.canonical.has(canonicalise(term));
}

/** The lines of the original CV supporting a canonical skill key. */
export function evidenceFor(
  inventory: SkillInventory,
  canonicalKey: string,
): readonly SkillEvidence[] {
  return inventory.evidence.get(canonicalKey) ?? [];
}

/** Vocabulary long enough to be matched inside model-written prose. */
export const PROSE_MATCHABLE_VOCABULARY: readonly string[] =
  FREE_TEXT_VOCABULARY.filter((t) => t.length >= MIN_FREE_TEXT_TERM_LENGTH);
