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

  /*
   * The everyday words of software work.
   *
   * These were missing, and their absence was doing real damage. A CV reading
   * "Implemented Zabbix for monitoring and Slurm for workload scheduling" was
   * refused a claim to monitoring, against an advert asking for monitoring
   * experience, with the reason "your CV does not mention this". The CV
   * mentions it. The vocabulary did not.
   *
   * Nothing here loosens the standard. A term still has to appear in the
   * applicant's own words before it is recorded, exactly like every term above
   * it. The gap was never about evidence; it was a list of technology names
   * with no room in it for what people say they did with them.
   */
  monitoring: ['observability', 'system monitoring', 'application monitoring'],
  logging: ['structured logging', 'log management'],
  alerting: ['alerts'],
  'incident management': [
    'incident response',
    'on-call',
    'on call',
    'postmortems',
    'post-mortems',
  ],
  debugging: ['troubleshooting', 'fault finding'],
  'software testing': [
    'testing',
    'unit testing',
    'integration testing',
    'test automation',
    'automated testing',
    'regression testing',
  ],
  'code review': ['peer review', 'pull request review'],
  'backend development': [
    'backend',
    'back end',
    'back-end',
    'backend developer',
    'server-side development',
  ],
  'frontend development': [
    'frontend',
    'front end',
    'front-end',
    'frontend developer',
    'client-side development',
  ],
  'full stack development': ['full stack', 'full-stack', 'fullstack'],
  'mobile development': [
    'mobile app development',
    'mobile application development',
  ],
  'web development': ['web application development'],
  'database design': [
    'schema design',
    'data modelling',
    'data modeling',
    'database modelling',
  ],
  'database administration': ['dba', 'database management'],
  'system administration': [
    'sysadmin',
    'systems administration',
    'server administration',
  ],
  deployment: ['release management'],
  automation: ['scripting', 'process automation'],
  'performance optimisation': [
    'performance optimization',
    'performance tuning',
    'query optimisation',
    'query optimization',
  ],
  microservices: ['microservice architecture'],
  'software architecture': ['system architecture', 'solution architecture'],
  'technical support': ['user support', 'help desk', 'helpdesk'],
  'requirements gathering': ['requirements analysis', 'business requirements'],
  prototyping: ['wireframing', 'rapid prototyping'],
  'cloud computing': ['cloud infrastructure', 'cloud-native'],
  'infrastructure as code': ['iac'],
  'workload scheduling': ['job scheduling', 'batch scheduling'],
  'high performance computing': ['hpc', 'cluster computing'],
  virtualisation: ['virtualization'],
  authentication: ['user authentication'],
  authorisation: ['authorization', 'access control'],
  encryption: ['cryptography'],
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

/**
 * Fold a plural to its singular, where doing so is safe.
 *
 * The guarded endings are the ones that are not plurals at all: "css", "ios",
 * "analysis", "status". Removing their last letter would invent a word and, in
 * the case of a skills list, silently stop two spellings of the same skill from
 * matching.
 */
function singular(term: string): string {
  if (/[^aeiou]ies$/.test(term)) return term.replace(/ies$/, 'y');
  if (/(ss|us|is|as|os)$/.test(term)) return term;
  if (/[^s]s$/.test(term)) return term.replace(/s$/, '');
  return term;
}

/** The same term written in the other number, for a second look at the map. */
function otherNumber(term: string): readonly string[] {
  const forms = new Set<string>();

  const one = singular(term);
  if (one !== term) forms.add(one);

  if (/[^aeiou]y$/.test(term)) forms.add(term.replace(/y$/, 'ies'));
  else if (!/s$/.test(term)) forms.add(`${term}s`);

  return [...forms];
}

/**
 * Normalise, then resolve through the alias map to a canonical key.
 *
 * Number is folded because a live tailoring refused "Agile methodology" on a CV
 * that says "Agile / Scrum coordination". The alias map holds the plural, the
 * model wrote the singular, and nothing in between looked at the last letter.
 * That is not a judgement about what the applicant can do; it is a spelling
 * mismatch deciding it.
 *
 * Both sides of every comparison run through this function, so folding here
 * keeps the inventory and the claims in step whichever number either uses.
 */
export function canonicalise(term: string): string {
  const normalised = normaliseTerm(term);

  const direct = ALIAS_TO_CANONICAL.get(normalised);
  if (direct) return direct;

  for (const variant of otherNumber(normalised)) {
    const viaVariant = ALIAS_TO_CANONICAL.get(variant);
    if (viaVariant) return viaVariant;
  }

  return singular(normalised);
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
/**
 * Split a skills line without cutting inside a bracket.
 *
 * The separator list contains a comma, and a real CV writes
 * "AWS (EC2, S3, Route 53, CloudFront)". Splitting first produced "AWS (EC2",
 * "S3", "Route 53" and "CloudFront)", so the inventory held `aws ec2` and never
 * plain `aws`. A live tailoring then refused AWS as unsupported, on a CV that
 * lists it, for a cloud infrastructure job.
 *
 * Bracketed spans are masked to a token carrying no separator, the existing
 * rule does the splitting, and the spans come back afterwards.
 */
function splitOutsideBrackets(text: string): string[] {
  const spans: string[] = [];
  const masked = text.replace(/\([^()]*\)/g, (match) => {
    spans.push(match);
    return `\u0000${spans.length - 1}\u0000`;
  });

  return masked
    .split(ENTRY_SEPARATOR)
    .map((part) =>
      part.replace(/\u0000(\d+)\u0000/g, (_, index: string) => spans[Number(index)] ?? ''),
    );
}

/**
 * The skills one part of a line actually claims.
 *
 * Two shapes need unpacking, and both appear on the same line of a real CV:
 *
 *   "Deployment: Docker"  the text before the colon is a category, not a skill
 *   "AWS (EC2, S3)"       the bracket lists specifics, and the base term counts
 *
 * The bracket case returns both. Someone who writes that has AWS, and has EC2
 * and S3, and a CV that says so should satisfy a claim to any of the three.
 */
function surfacesFrom(part: string): string[] {
  let text = part.trim().replace(/^[-\u2022\u00b7*\s]+/, '');

  const labelled = /^[^:]{1,40}:\s*(.+)$/.exec(text);
  if (labelled) text = labelled[1].trim();
  if (!text) return [];

  const bracketed = /^(.+?)\s*\(([^()]*)\)\s*$/.exec(text);
  if (!bracketed) return [text];

  const base = bracketed[1].trim();
  const inner = bracketed[2]
    .split(/[,;]/)
    .map((value) => value.trim())
    .filter(Boolean);

  return [base, ...inner].filter(Boolean);
}

export function extractSkillsSectionEntries(
  lines: readonly string[],
): { surface: string; line: string }[] {
  const entries: { surface: string; line: string }[] = [];
  let inSkills = false;

  for (const line of lines) {
    const inline = INLINE_SKILLS_HEADING.exec(line);
    if (inline) {
      for (const part of splitOutsideBrackets(inline[3])) {
        for (const surface of surfacesFrom(part)) {
          entries.push({ surface, line: line.trim() });
        }
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

      for (const part of splitOutsideBrackets(line)) {
        for (const surface of surfacesFrom(part)) {
          if (surface.length <= 60) {
            entries.push({ surface, line: line.trim() });
          }
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
