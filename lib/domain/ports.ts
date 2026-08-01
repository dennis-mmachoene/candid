/**
 * Ports — interfaces the domain owns and the infrastructure layer implements.
 *
 * The domain depends on these; it never depends on Supabase, Anthropic or the
 * filesystem. That inversion is what makes the ethical rules testable with
 * plain fakes, and what makes the AI provider swappable without touching a
 * single business rule.
 */

import type {
  IdentityHeader,
  IntegrityReport,
  SkillGap,
  TailoredDraft,
} from './types';

// ---------------------------------------------------------------------------
// AI provider
// ---------------------------------------------------------------------------

/**
 * What we hand to a model. Note what is absent: there is no field for a name,
 * an email, a phone number or an ID number. The port makes leaking identity a
 * type error rather than an oversight.
 */
export interface TailorRequest {
  /**
   * De-identified CV content only — the output of `deidentify()`. Callers must
   * not pass raw parsed text.
   */
  deidentifiedCv: string;
  /**
   * The pasted job advert. Untrusted user input: the adapter must delimit it
   * and instruct the model to treat it as reference data, never as
   * instructions.
   */
  jobAdvert: string;
}

export interface AIProvider {
  /**
   * Rephrase the supplied experience against the advert. Implementations must
   * reject a malformed reply at the boundary rather than passing it inward.
   *
   * @throws if the provider returns a reply that fails schema validation.
   */
  tailor(request: TailorRequest): Promise<TailoredDraft>;
}

// ---------------------------------------------------------------------------
// CV parsing
// ---------------------------------------------------------------------------

export type CvFormat = 'pdf' | 'docx';

export interface ParsedCv {
  format: CvFormat;
  /** Raw extracted text. Still fully identifying — de-identify before use. */
  text: string;
}

export interface CvParser {
  /**
   * Parse an uploaded file. Implementations must determine the format from
   * magic bytes, never from a browser-supplied MIME type or file extension,
   * and must treat the contents as hostile input.
   *
   * @throws if the bytes are not a supported format or exceed the size cap.
   */
  parse(bytes: Uint8Array): Promise<ParsedCv>;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export interface StoredResume {
  id: string;
  createdAt: Date;
  /** De-identified content. The identity header is stored encrypted, apart. */
  content: string;
  format: CvFormat;
}

export interface StoredTailoring {
  id: string;
  resumeId: string;
  createdAt: Date;
  status: 'review' | 'approved' | 'exported' | 'blocked';
  draft: TailoredDraft;
  report: IntegrityReport;
  approvedClaims: readonly string[];
  gaps: readonly SkillGap[];
}

/**
 * Persistence port. Every implementation is expected to be scoped to the
 * signed-in user by Row-Level Security — the repository never takes a user id
 * as an argument, because accepting one would invite passing an attacker's.
 */
export interface ResumeRepository {
  saveResume(input: {
    content: string;
    format: CvFormat;
    identity: IdentityHeader;
  }): Promise<StoredResume>;

  getResume(id: string): Promise<StoredResume | null>;

  /** Decrypted server-side, for reattachment at export time only. */
  getIdentity(resumeId: string): Promise<IdentityHeader | null>;

  listResumes(): Promise<readonly StoredResume[]>;

  saveTailoring(input: {
    resumeId: string;
    draft: TailoredDraft;
    report: IntegrityReport;
  }): Promise<StoredTailoring>;

  setApprovedClaims(
    tailoringId: string,
    canonicalKeys: readonly string[],
  ): Promise<void>;

  getTailoring(id: string): Promise<StoredTailoring | null>;

  /** POPIA §24. Deletes every row the user owns; auth deletion is separate. */
  deleteEverything(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

export interface RateLimiter {
  /**
   * Implementations must fail closed: if the check itself errors, deny.
   * Returns true when the caller may proceed.
   */
  consume(action: string): Promise<boolean>;
}
