/**
 * Candid — core domain types.
 *
 * Everything in `lib/domain` is pure: no vendor SDK, no Next.js, no I/O.
 * The two guarantees this product exists to make — it never fabricates
 * experience, and it never leaks identity — are expressed in this layer so
 * they can be tested in isolation from Supabase, Anthropic and the browser.
 */

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/**
 * The personal identifiers lifted off a CV before anything reaches a model.
 * This never crosses the network to Claude. It is encrypted at rest
 * (AES-256-GCM, application layer) and reattached server-side after the model
 * responds.
 *
 * Note there is deliberately no field for a South African ID number. ID numbers
 * are redacted and discarded — never stored, never reattached. See §6 of the
 * build spec and the migration comment in supabase/migrations.
 */
export interface IdentityHeader {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  /**
   * City and province, and nothing more precise.
   *
   * This was being thrown away with the rest of the header, and it costs
   * people interviews. South African adverts filter on location before they
   * filter on anything else, so a CV that does not say where you are reads as
   * a CV from somewhere inconvenient.
   *
   * The street address is still discarded. An employer needs to know you are
   * in Pretoria; nobody needs your house number, and keeping it would be
   * collecting more than the purpose requires.
   */
  location: string | null;
  /**
   * Profile links — LinkedIn, GitHub and the like.
   *
   * Same problem as the location. They sat in the discarded header lines, so a
   * developer's GitHub never reached the document that was meant to get them
   * hired. Never sent to the model; reattached on export like the rest.
   */
  links: string[];
  /**
   * Remaining lines of the CV's header block (address, portfolio links, and so
   * on). We keep these server-side rather than forwarding them, on the
   * principle that anything sitting in the header block is presumed
   * identifying until proven otherwise.
   */
  otherLines: string[];
}

/** Result of stripping identity from a parsed CV. */
export interface DeidentificationResult {
  /** Identifiers held back on the server. */
  identity: IdentityHeader;
  /**
   * The only text that may ever be sent to an AI provider: experience, skills
   * and education, with the header block removed and ID numbers redacted.
   */
  content: string;
  /** How many South African ID numbers were redacted. */
  redactedIdCount: number;
}

// ---------------------------------------------------------------------------
// Skill inventory (the record of what the user can actually back up)
// ---------------------------------------------------------------------------

/** A skill as written in the source CV, plus the line it came from. */
export interface SkillEvidence {
  /** The exact text found in the original CV. */
  surface: string;
  /** The line of the original CV containing it — shown to the user as proof. */
  line: string;
}

/**
 * The verifiable inventory built from the original CV. A claim that cannot be
 * traced back into this structure has no business appearing in an export.
 */
export interface SkillInventory {
  /** Canonical skill keys the user demonstrably claimed. */
  canonical: ReadonlySet<string>;
  /** Canonical key -> the evidence it was drawn from. */
  evidence: ReadonlyMap<string, readonly SkillEvidence[]>;
  /** Normalised full CV text, retained for phrase-level inference checks. */
  normalisedText: string;
  /** The original CV split into lines, for quoting evidence back to the user. */
  lines: readonly string[];
}

// ---------------------------------------------------------------------------
// Claims and verdicts (the anti-fabrication rule)
// ---------------------------------------------------------------------------

/**
 * Where in the model's draft a claim was made. All of them matter: a fabricated
 * skill buried in a bullet is exactly as dishonest as one in the skills list,
 * and an invented employer is worse than either.
 *
 * `position` is the employer, title and dates of a job. `education` is a
 * qualification and the institution that awarded it.
 */
export type ClaimSource =
  | 'skill'
  | 'bullet'
  | 'summary'
  | 'position'
  | 'education';

/**
 * What kind of assertion this is. The distinction matters because the rules
 * differ: a skill can be a fair inference from stated experience, while an
 * employer or a date cannot be inferred from anything. Either the CV names it
 * or the model invented it.
 */
export type ClaimKind = 'skill' | 'employer' | 'date' | 'institution';

/**
 * Where inside the draft a claim came from, precisely enough to remove the
 * right thing when it fails.
 *
 * `positionIndex` alone means the claim is about the position itself — its
 * employer, its title, its dates. That is the case where the whole position
 * has to go, because bullets with no employer attached are worse than no
 * bullets at all.
 *
 * `positionIndex` with `bulletIndex` means one bullet inside that position,
 * and only that bullet is dropped.
 */
export interface Claim {
  /** The skill, employer, date or institution being asserted, as written. */
  text: string;
  kind: ClaimKind;
  source: ClaimSource;
  /** Which position this claim belongs to, when source is 'position'. */
  positionIndex?: number;
  /** Which bullet inside that position, when the claim came from a bullet. */
  bulletIndex?: number;
  /** Which qualification, when source is 'education'. */
  qualificationIndex?: number;
  /**
   * Which date this claim is about, when it is a date claim on a position.
   *
   * A date that cannot be verified removes the date, not the job. Knowing which
   * one is what makes that possible. Dropping an entire job because one date
   * could not be confirmed is how somebody with eight years of history
   * downloaded a CV showing three.
   */
  dateSlot?: 'start' | 'end' | 'year';
  /**
   * The position's own assertions, carried with the claim so they can be
   * judged together rather than one at a time.
   *
   * A position raises **one** claim, not four. Checking the employer, the
   * title and the two dates separately is what allowed a date belonging to
   * another job to pass — each field existed somewhere in the CV, so each
   * passed on its own. They only make sense judged as a unit.
   *
   * It also fixes something the user sees. Splitting a position into fragments
   * meant the review screen could ask someone to approve the word "presenting"
   * with no context. One claim per position gives them one legible line.
   */
  position?: {
    /** Employer, or the institution for a qualification. */
    organisation: string;
    /** Job title, or the award for a qualification. */
    label: string;
    dates: readonly string[];
    /** The CV text the model says this came from. Verified, never trusted. */
    evidence: string;
  };
}

/**
 * - `accepted`   — traces directly to the original CV.
 * - `borderline` — a fair inference from stated experience. Shown to the user
 *                  with its evidence, and included only on explicit approval.
 * - `blocked`    — no trace at all. Never included, under any circumstances.
 */
export type Verdict = 'accepted' | 'borderline' | 'blocked';

export interface ValidatedClaim {
  claim: Claim;
  verdict: Verdict;
  /** Canonical key the claim resolved to. */
  canonical: string;
  /** Why this verdict was reached — surfaced to the user verbatim. */
  reason: string;
  /**
   * The lines of the original CV this claim was drawn from. Required for
   * `borderline`: the user cannot fairly approve an inference without seeing
   * what it was inferred from.
   */
  evidence: readonly SkillEvidence[];
}

/** The integrity report shown alongside every tailored draft. */
export interface IntegrityReport {
  accepted: readonly ValidatedClaim[];
  borderline: readonly ValidatedClaim[];
  blocked: readonly ValidatedClaim[];
}

/**
 * Canonical keys of borderline claims the user explicitly approved. Stored in
 * `tailored_resumes.approved_claims`.
 */
export type ApprovedClaims = ReadonlySet<string>;

// ---------------------------------------------------------------------------
// Model output
// ---------------------------------------------------------------------------

/** An honest gap: something the advert wants that the CV does not support. */
export interface SkillGap {
  skill: string;
  /** Why it matters for this advert, in the user's own context. */
  note: string;
}

/**
 * One job. The employer, the title and the dates are facts about the person's
 * history, not phrasing — they are copied from the source CV and never
 * rewritten. Only the bullets are the model's work.
 *
 * An absent date stays absent. A model that cannot find an end date must leave
 * it empty rather than reach for a plausible one, because a plausible date on a
 * CV is a lie with a background check waiting behind it.
 */
export interface Position {
  employer: string;
  title: string;
  /** As written in the CV — "2020", "March 2020", "" if the CV does not say. */
  startDate: string;
  /** "present" is a legitimate value. Empty means the CV did not state one. */
  endDate: string;
  bullets: readonly string[];
  /**
   * The exact text from the CV this job's header was read from.
   *
   * This replaces every layout rule the validator used to have, and the reason
   * is worth keeping. Verification used to work by position — find the employer
   * line, decide which nearby lines belonged to that job, check the title and
   * dates fell inside. Position is a property of *formatting*, not of truth, so
   * the moment a CV was laid out differently the checks failed on true facts
   * and deleted real jobs. Two of three common layouts broke. One of them was
   * a Word table, where every field lands on its own line.
   *
   * A quote does not care how the document is laid out. The model reads the CV
   * however it is shaped, and says which text it drew the job from. All the
   * validator asks is whether that text is really in the CV, and whether it
   * contains what the model claims it contains.
   *
   * It is also stricter than the old rule. A date cannot be moved from one job
   * to another, because doing so means quoting text that does not contain this
   * job's employer.
   */
  evidence: string;
  /**
   * Set only when a tailoring stored before structured history was read back.
   *
   * Those records hold a flat list of bullets and no employer, because there
   * was nowhere to put one. The reader maps them forward into a single position
   * so the record still opens, and marks it: no provenance claims are raised
   * against it, and the drop-untraceable-position rule does not apply — which
   * would otherwise erase every old document entirely.
   *
   * Nothing sets this on a new draft. An employer that was never stored cannot
   * be recovered, and inventing one to fill the gap would be the exact thing
   * this product exists not to do.
   */
  legacy?: true;
}

/** One qualification. Same rule: the award, the institution and the year are copied. */
export interface Qualification {
  award: string;
  institution: string;
  /** Empty when the CV does not give one. */
  year: string;
  /** The exact CV text this qualification was read from. See Position.evidence. */
  evidence: string;
}

/**
 * The shape we require back from any AI provider. Validated with Zod at the
 * infrastructure boundary before it is ever handed to the domain.
 *
 * There is deliberately no flat `bullets` field any more, and this is the whole
 * point of the type rather than a tidy-up.
 *
 * The previous version had one, with nowhere to record an employer, a title, a
 * date or a qualification. All of that reached the model intact and was thrown
 * away on the way out, so the exported document was a summary and an
 * ownerless list of bullets under a heading reading EXPERIENCE. A recruiter
 * reads that as concealment and an applicant tracking system cannot extract a
 * work history from it at all — which is the one job this product exists to do.
 *
 * Keeping the old field alongside the new one would guarantee that something
 * eventually read from it. So it is gone.
 */
export interface TailoredDraft {
  summary: string;
  positions: readonly Position[];
  qualifications: readonly Qualification[];
  skills: readonly string[];
  gaps: readonly SkillGap[];
}

// ---------------------------------------------------------------------------
// Neutral document model (what both exporters consume)
// ---------------------------------------------------------------------------

/**
 * ATS-parseable by construction. There is no table block, no image block, no
 * column block and no header/footer — a structure that cannot express them
 * cannot accidentally emit them. §9 of the spec is enforced by this type, not
 * by reviewer vigilance.
 *
 * `entry` is one emphasised line: the job title, employer and dates that sit
 * above a position's bullets, or the award and institution above a
 * qualification. It renders as bold text and nothing else. Bold is the one
 * piece of formatting an applicant tracking system reads reliably, which is
 * why the alternative — a two-column layout with dates on the right, the way a
 * designer would do it — is not expressible here and never will be.
 */
export type DocumentBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'entry'; text: string }
  | { kind: 'bullets'; items: readonly string[] };

export interface DocumentSection {
  /** A conventional heading an ATS will recognise. See ATS_SECTION_HEADINGS. */
  heading: string;
  blocks: readonly DocumentBlock[];
}

export interface ResumeDocument {
  identity: IdentityHeader;
  sections: readonly DocumentSection[];
}

// ---------------------------------------------------------------------------
// Consent (POPIA)
// ---------------------------------------------------------------------------

/** A third party that processes user data on Candid's behalf. */
export interface Operator {
  name: string;
  purpose: string;
  /** Where the processing happens — POPIA §72 cross-border transfer notice. */
  jurisdiction: string;
  /** True when identifying data reaches this operator. */
  receivesIdentifyingData: boolean;
}

export interface ConsentRecord {
  policyVersion: string;
  acceptedAt: Date;
  operators: readonly Operator[];
}
