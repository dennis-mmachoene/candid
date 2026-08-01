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
 * Where in the model's draft a claim was made. Both matter: a fabricated skill
 * buried in a bullet is exactly as dishonest as one in the skills list.
 */
export type ClaimSource = 'skill' | 'bullet' | 'summary';

/** A single assertion extracted from the model's draft, awaiting judgement. */
export interface Claim {
  /** The skill or competency being asserted, as the model wrote it. */
  text: string;
  source: ClaimSource;
  /**
   * Index of the bullet this claim came from, when `source` is 'bullet'.
   * Lets us drop the whole bullet if the claim inside it is blocked.
   */
  bulletIndex?: number;
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
 * The shape we require back from any AI provider. Validated with Zod at the
 * infrastructure boundary before it is ever handed to the domain.
 */
export interface TailoredDraft {
  summary: string;
  bullets: readonly string[];
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
 */
export type DocumentBlock =
  | { kind: 'paragraph'; text: string }
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
