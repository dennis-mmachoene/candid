/**
 * Ports — interfaces the domain owns and the infrastructure layer implements.
 *
 * The domain depends on these; it never depends on Supabase, Anthropic or the
 * filesystem. That inversion is what makes the ethical rules testable with
 * plain fakes, and what makes the AI provider swappable without touching a
 * single business rule.
 */

import type {
  CvHeader,
  IntegrityReport,
  SkillGap,
  TailoredDraft,
} from './types';

// ---------------------------------------------------------------------------
// AI provider
// ---------------------------------------------------------------------------

/**
 * What we hand to a model: the applicant's CV and the advert, and nothing
 * else. No instructions to follow, no prior draft to extend, no list of
 * skills to aim for. The model rephrases what is already there.
 */
export interface TailorRequest {
  /** The applicant's CV, as uploaded. */
  cv: string;
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
  /** The extracted text of the uploaded CV. */
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
  /**
   * What the person called the file when they uploaded it.
   *
   * Stored since the first migration and never read back, so three CVs all
   * showed as "DOCX CV" and were impossible to tell apart. It is the only
   * label the user recognises.
   */
  originalFilename: string | null;
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
    identity: CvHeader;
  }): Promise<StoredResume>;

  getResume(id: string): Promise<StoredResume | null>;

  /** Decrypted server-side, for reattachment at export time only. */
  getProfileHeader(): Promise<CvHeader | null>;
  saveProfileHeader(header: CvHeader): Promise<void>;

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

  /**
   * Remove one CV and everything tailored from it.
   *
   * "Delete my whole account" was the only way to remove a bad upload, which
   * is not a reasonable thing to ask of someone whose parser output looked
   * wrong once.
   */
  deleteResume(id: string): Promise<void>;

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
