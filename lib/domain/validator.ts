/**
 * Guarantee 2 — Candid never fabricates experience.
 *
 * Every claim the model makes is judged against the user's own inventory by one
 * ordered chain of specifications. The rule lives here as a single object rather
 * than as conditionals sprinkled through the request handlers, so that it can be
 * tested on its own and so that there is exactly one place to audit.
 *
 * Three verdicts, and the ordering between them is the whole design:
 *
 *   accepted   — traces directly to the original CV.
 *   borderline — a fair inference from stated experience. Shown with the
 *                evidence it was drawn from; included only on explicit approval.
 *   blocked    — no trace at all. Never included. Not on approval, not on
 *                request, not by any code path.
 *
 * The fallthrough is `blocked`, not `accepted`. A claim the rule does not
 * understand is refused rather than waved through.
 */

import {
  PROSE_MATCHABLE_VOCABULARY,
  canonicalise,
  evidenceFor,
} from './inventory';
import {
  appearsInSource,
  extractProvenanceMentions,
  tracePosition,
} from './provenance';
import type {
  Claim,
  IntegrityReport,
  SkillEvidence,
  SkillInventory,
  TailoredDraft,
  ValidatedClaim,
  Verdict,
} from './types';

// ---------------------------------------------------------------------------
// Fair inferences
// ---------------------------------------------------------------------------

/**
 * A competency a reasonable reader would grant on the strength of something the
 * CV states outright — "led a team of five" genuinely does evidence team
 * leadership, even if the phrase never appears.
 *
 * These are the only inferences permitted, and each still requires the user's
 * explicit approval before it can be printed. The list is deliberately
 * conservative: each rule must be defensible in an interview, where the
 * candidate will be asked about it.
 */
export interface InferenceRule {
  /** Canonical key this rule can infer. */
  infers: string;
  /** Phrases in the original CV that license the inference. */
  triggers: readonly RegExp[];
  /** Shown to the user next to the evidence, explaining the leap being made. */
  rationale: string;
}

export const INFERENCE_RULES: readonly InferenceRule[] = [
  {
    infers: 'team leadership',
    triggers: [
      /\bled\s+(?:a\s+)?(?:team|group|squad|crew)/i,
      /\bmanaged\s+(?:a\s+)?(?:team|group|staff|\d+\s+(?:people|staff|reports))/i,
      /\bsupervis(?:ed|ing)\s+\d+/i,
      /\bteam\s+(?:lead|leader)\b/i,
      /\bline\s+manag(?:ed|er|ement)/i,
    ],
    rationale:
      'Your CV describes leading or managing people directly, which supports a claim of team leadership.',
  },
  {
    infers: 'mentoring',
    triggers: [
      /\bmentor(?:ed|ing)?\b/i,
      /\bcoach(?:ed|ing)\b/i,
      /\btrained\s+(?:junior|new|graduate)/i,
      /\bonboard(?:ed|ing)\s+new/i,
    ],
    rationale:
      'Your CV describes developing or training colleagues, which supports a claim of mentoring.',
  },
  {
    infers: 'stakeholder management',
    triggers: [
      /\bstakeholder/i,
      /\bliais(?:ed|ing)\s+with\s+(?:clients|customers|vendors|suppliers|departments)/i,
      /\bclient[-\s]facing\b/i,
      /\breported\s+to\s+(?:the\s+)?(?:board|executive|c-suite)/i,
    ],
    rationale:
      'Your CV describes working directly with stakeholders or clients, which supports this claim.',
  },
  {
    infers: 'project management',
    triggers: [
      /\bmanaged\s+(?:the\s+|a\s+|multiple\s+)?projects?\b/i,
      /\bdeliver(?:ed|ing)\s+(?:the\s+|a\s+)?projects?\b/i,
      /\bcoordinat(?:ed|ing)\s+(?:the\s+|a\s+)?(?:projects?|rollouts?|migrations?)/i,
      /\bproject\s+(?:lead|owner|manager)\b/i,
    ],
    rationale:
      'Your CV describes running projects end to end, which supports a claim of project management.',
  },
  {
    infers: 'budget management',
    triggers: [
      /\bbudgets?\s+of\b/i,
      /\bmanaged\s+(?:a\s+)?budget/i,
      /\bcost\s+(?:control|savings?|reduction)/i,
      /\bp&l\b/i,
    ],
    rationale:
      'Your CV describes responsibility for budgets or costs, which supports this claim.',
  },
  {
    infers: 'public speaking',
    triggers: [
      /\bpresent(?:ed|ing|ations?)\s+to\b/i,
      /\bconference\s+(?:talk|speaker|presentation)/i,
      /\bfacilitat(?:ed|ing)\s+(?:a\s+)?workshops?/i,
      /\bran\s+(?:training\s+)?(?:sessions?|workshops?)/i,
    ],
    rationale:
      'Your CV describes presenting or facilitating for an audience, which supports this claim.',
  },
  {
    infers: 'agile methodologies',
    triggers: [
      /\bsprints?\b/i,
      /\bstand-?ups?\b/i,
      /\bbacklog\s+(?:grooming|refinement)/i,
      /\bretrospectives?\b/i,
    ],
    rationale:
      'Your CV describes working in sprints or agile ceremonies, which supports this claim.',
  },
  {
    infers: 'cross-functional collaboration',
    triggers: [
      /\bcross[-\s]functional/i,
      /\bworked\s+(?:closely\s+)?with\s+(?:design|product|marketing|engineering|sales|finance)/i,
      /\bpartnered\s+with\s+\w+\s+teams?/i,
    ],
    rationale:
      'Your CV describes working across team boundaries, which supports this claim.',
  },
  {
    infers: 'data analysis',
    triggers: [
      /\banalys(?:ed|is|ing)\s+(?:data|trends|results|performance)/i,
      /\bbuilt\s+(?:reports?|dashboards?)/i,
      /\breporting\s+(?:on|for)\b/i,
    ],
    rationale:
      'Your CV describes analysing data or producing reporting, which supports this claim.',
  },
  {
    infers: 'process improvement',
    triggers: [
      /\bstreamlin(?:ed|ing)\b/i,
      /\bautomat(?:ed|ing)\s+(?:the\s+)?(?:process|workflow|reporting)/i,
      /\breduc(?:ed|ing)\s+(?:turnaround|processing)\s+time/i,
      /\bimproved\s+(?:the\s+)?(?:process|efficiency)/i,
    ],
    rationale:
      'Your CV describes improving how work gets done, which supports this claim.',
  },
];

// ---------------------------------------------------------------------------
// Specifications
// ---------------------------------------------------------------------------

export interface SpecificationMatch {
  canonical: string;
  reason: string;
  evidence: readonly SkillEvidence[];
}

/**
 * One rule in the chain. Returns a match, or null to defer to the next rule.
 */
export interface ClaimSpecification {
  readonly name: string;
  readonly verdict: Verdict;
  evaluate(claim: Claim, inventory: SkillInventory): SpecificationMatch | null;
}

/** "Senior Developer, Absa Bank (2020 – present)" — one legible line. */
export function describePosition(position: {
  employer: string;
  title: string;
  startDate: string;
  endDate: string;
}): string {
  const who = [position.title, position.employer].filter((s) => s.trim()).join(', ');
  const when = [position.startDate, position.endDate]
    .filter((s) => s.trim())
    .join(' – ');
  return when ? `${who} (${when})` : who;
}

/** "BSc Computer Science, University of Pretoria (2017)". */
export function describeQualification(qualification: {
  award: string;
  institution: string;
  year: string;
}): string {
  const what = [qualification.award, qualification.institution]
    .filter((s) => s.trim())
    .join(', ');
  return qualification.year.trim() ? `${what} (${qualification.year})` : what;
}

/**
 * A position or a qualification, judged as a whole against its own block of the
 * CV rather than field by field.
 *
 * Runs before the skill rules and has no borderline path. An employer cannot be
 * inferred, a date cannot be inferred, and a job title cannot be inferred. The
 * CV says so or it does not.
 */
export const PositionMatchesSource: ClaimSpecification = {
  name: 'PositionMatchesSource',
  verdict: 'accepted',
  evaluate(claim, inventory) {
    if (!claim.position) return null;

    const trace = tracePosition(claim.position, inventory.lines);
    if (!trace.employerTraced || !trace.titleTraced) return null;
    if (trace.untracedDates.length > 0) return null;

    const anchor = inventory.lines.find((line) =>
      appearsInSource(claim.position!.employer, line),
    );

    return {
      canonical: `${claim.kind}:${normaliseKey(claim.text)}`,
      reason:
        claim.source === 'education'
          ? 'This qualification, institution and year all appear together in your CV.'
          : 'This employer, job title and both dates all appear together in your CV.',
      evidence: anchor ? [{ surface: claim.text, line: anchor.trim() }] : [],
    };
  },
};

/**
 * An organisation or date named inside a bullet or the summary.
 *
 * Positions and qualifications no longer come through here — they carry their
 * own fields and are judged by PositionMatchesSource above, scoped to their own
 * block of the CV. What is left is prose: "built the integration with Absa",
 * "since 2019". A flat containment check is the right tool for those, because
 * there is no structure to scope them to.
 *
 * No inference path exists here either. "Led a team of five" evidences team
 * leadership; nothing evidences an employer the CV never mentions.
 */
export const NamedInSourceCv: ClaimSpecification = {
  name: 'NamedInSourceCv',
  verdict: 'accepted',
  evaluate(claim, inventory) {
    if (claim.kind === 'skill') return null;
    if (claim.position) return null;
    if (!appearsInSource(claim.text, inventory.lines.join('\n'))) return null;

    const line = inventory.lines.find((candidate) =>
      appearsInSource(claim.text, candidate),
    );

    return {
      canonical: `${claim.kind}:${claim.text.toLowerCase()}`,
      reason:
        claim.kind === 'employer'
          ? 'This organisation is named in your original CV.'
          : claim.kind === 'institution'
            ? 'This institution is named in your original CV.'
            : 'This date appears in your original CV.',
      evidence: line ? [{ surface: claim.text, line: line.trim() }] : [],
    };
  },
};

/** The claim appears in the CV, under this or a recognised alternate spelling. */
export const TraceableToInventory: ClaimSpecification = {
  name: 'TraceableToInventory',
  verdict: 'accepted',
  evaluate(claim, inventory) {
    if (claim.kind !== 'skill') return null;
    const canonical = canonicalise(claim.text);
    if (!canonical || !inventory.canonical.has(canonical)) return null;
    return {
      canonical,
      reason: 'This appears in your original CV.',
      evidence: evidenceFor(inventory, canonical),
    };
  },
};

/** The claim is a defensible reading of something the CV states outright. */
export const FairInferenceFromExperience: ClaimSpecification = {
  name: 'FairInferenceFromExperience',
  verdict: 'borderline',
  evaluate(claim, inventory) {
    if (claim.kind !== 'skill') return null;
    const canonical = canonicalise(claim.text);
    if (!canonical) return null;

    const rule = INFERENCE_RULES.find((r) => r.infers === canonical);
    if (!rule) return null;

    const evidence: SkillEvidence[] = [];
    for (const line of inventory.lines) {
      const trigger = rule.triggers.find((t) => t.test(line));
      if (trigger) {
        evidence.push({ surface: line.trim(), line: line.trim() });
      }
    }
    if (evidence.length === 0) return null;

    return { canonical, reason: rule.rationale, evidence };
  },
};

/**
 * The ordered chain. Order is significant: a claim that traces directly must
 * never be demoted to an inference, and nothing may be appended after the
 * blocked fallthrough.
 */
export const SPECIFICATION_CHAIN: readonly ClaimSpecification[] = [
  PositionMatchesSource,
  NamedInSourceCv,
  TraceableToInventory,
  FairInferenceFromExperience,
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateClaim(
  claim: Claim,
  inventory: SkillInventory,
): ValidatedClaim {
  for (const specification of SPECIFICATION_CHAIN) {
    const match = specification.evaluate(claim, inventory);
    if (match) {
      return {
        claim,
        verdict: specification.verdict,
        canonical: match.canonical,
        reason: match.reason,
        evidence: match.evidence,
      };
    }
  }

  const reason =
    claim.kind === 'employer'
      ? 'Your CV does not name this organisation. Candid will not add an employer you did not list.'
      : claim.kind === 'institution'
        ? 'Your CV does not name this institution. Candid will not add a qualification you did not list.'
        : claim.kind === 'date'
          ? 'This date does not appear in your CV. Candid will not change your employment dates.'
          : 'Nothing in your CV supports this. Candid will not add it — if you do have this experience, add it to your CV and upload again.';

  return {
    claim,
    verdict: 'blocked',
    canonical:
      claim.kind === 'skill'
        ? canonicalise(claim.text)
        : `${claim.kind}:${claim.text.toLowerCase()}`,
    reason,
    evidence: [],
  };
}

export function validateClaims(
  claims: readonly Claim[],
  inventory: SkillInventory,
): readonly ValidatedClaim[] {
  return claims.map((claim) => validateClaim(claim, inventory));
}

// ---------------------------------------------------------------------------
// Extracting claims from a draft
// ---------------------------------------------------------------------------

/** Stable canonical key for a claim whose text is a whole descriptive line. */
function normaliseKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Vocabulary terms asserted inside a piece of model-written prose. */
function claimsInProse(text: string): string[] {
  const found: string[] = [];
  for (const term of PROSE_MATCHABLE_VOCABULARY) {
    const pattern = new RegExp(
      `(?<![a-z0-9])${escapeRegExp(term)}(?![a-z0-9])`,
      'i',
    );
    if (pattern.test(text)) found.push(term);
  }
  return found;
}

/**
 * Every assertion in a draft that needs judging.
 *
 * Bullets and the summary are scanned as well as the skills list. A fabricated
 * skill buried in a bullet — "used Kubernetes to orchestrate deployments" — is
 * exactly as dishonest as one in the skills array, and checking only the array
 * would leave the obvious hole open.
 *
 * Employers, titles, dates and institutions are now fields rather than prose,
 * and that is a real strengthening of the guarantee rather than a tidy-up.
 * Previously the only way to catch an invented employer was to scrape it out of
 * a sentence with a regular expression, which is why the documentation had to
 * describe employer detection as heuristic: a lowercase name, or a company
 * whose name is an ordinary word, slipped through. A field can be compared to
 * the source CV exactly. Nothing is guessed at any more.
 */
export function extractClaims(draft: TailoredDraft): readonly Claim[] {
  const claims: Claim[] = [];

  for (const skill of draft.skills) {
    const text = skill.trim();
    if (text) claims.push({ text, kind: 'skill', source: 'skill' });
  }

  draft.positions.forEach((position, positionIndex) => {
    // A record written before structured history has no employer to check and
    // never will. Raising a claim against it would block it and erase the
    // document, so it is carried through as-is.
    if (!position.legacy) {
      claims.push({
        text: describePosition(position),
        kind: 'employer',
        source: 'position',
        positionIndex,
        position: {
          employer: position.employer,
          title: position.title,
          startDate: position.startDate,
          endDate: position.endDate,
        },
      });
    }

    position.bullets.forEach((bullet, bulletIndex) => {
      for (const term of claimsInProse(bullet)) {
        claims.push({
          text: term,
          kind: 'skill',
          source: 'bullet',
          positionIndex,
          bulletIndex,
        });
      }
      // An organisation named inside a bullet is still worth catching — "built
      // the integration with Absa" is an employer claim wherever it sits.
      for (const mention of extractProvenanceMentions(bullet)) {
        claims.push({
          text: mention.text,
          kind: mention.kind,
          source: 'bullet',
          positionIndex,
          bulletIndex,
        });
      }
    });
  });

  // A qualification is judged as a unit for the same reason a position is: the
  // award, the institution and the year are only meaningful together.
  draft.qualifications.forEach((qualification, qualificationIndex) => {
    if (!qualification.institution.trim() && !qualification.award.trim()) return;
    claims.push({
      text: describeQualification(qualification),
      kind: 'institution',
      source: 'education',
      qualificationIndex,
      position: {
        employer: qualification.institution,
        title: qualification.award,
        startDate: qualification.year,
        endDate: '',
      },
    });
  });

  for (const term of claimsInProse(draft.summary)) {
    claims.push({ text: term, kind: 'skill', source: 'summary' });
  }
  for (const mention of extractProvenanceMentions(draft.summary)) {
    claims.push({ text: mention.text, kind: mention.kind, source: 'summary' });
  }

  return claims;
}

// ---------------------------------------------------------------------------
// The integrity report
// ---------------------------------------------------------------------------

export function buildIntegrityReport(
  validated: readonly ValidatedClaim[],
): IntegrityReport {
  return {
    accepted: validated.filter((v) => v.verdict === 'accepted'),
    borderline: validated.filter((v) => v.verdict === 'borderline'),
    blocked: validated.filter((v) => v.verdict === 'blocked'),
  };
}

/** Validate a whole draft against an inventory and report on it. */
export function reviewDraft(
  draft: TailoredDraft,
  inventory: SkillInventory,
): IntegrityReport {
  return buildIntegrityReport(validateClaims(extractClaims(draft), inventory));
}
