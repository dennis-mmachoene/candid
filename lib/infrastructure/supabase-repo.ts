import 'server-only';

import { createClient } from './supabase/server';
import { decryptIdentityHeader, encryptIdentityHeader } from './crypto';
import type {
  CvFormat,
  ResumeRepository,
  StoredResume,
  StoredTailoring,
} from '@/lib/domain/ports';
import type {
  IdentityHeader,
  IntegrityReport,
  SkillInventory,
  TailoredDraft,
} from '@/lib/domain/types';

/**
 * Supabase implementation of the ResumeRepository port.
 *
 * Notice what no method here accepts: a user id. Every query runs under the
 * caller's own session with the publishable key, so Row-Level Security scopes
 * it to their rows. Taking a user id as an argument would invite a caller to
 * pass someone else's, and would mean isolation depended on our `where`
 * clauses being right rather than on the database refusing.
 *
 * The identity header is encrypted here, on the way in, and decrypted here, on
 * the way out. Nothing above this layer handles the ciphertext and nothing
 * below it sees the plaintext.
 */

/** A row in the history list. Deliberately lighter than a full tailoring. */
export interface StoredTailoringSummary {
  id: string;
  resumeId: string;
  createdAt: Date;
  status: string;
  title: string | null;
  advertExcerpt: string;
  acceptedCount: number;
  borderlineCount: number;
  blockedCount: number;
  approvedCount: number;
  gapCount: number;
}

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Postgres error text can name tables, columns and constraints. That belongs in
 * a server log, not in a response body, so callers get one generic sentence and
 * the detail is logged separately.
 */
function fail(operation: string, detail: unknown): never {
  console.error(`[repo] ${operation} failed`, detail);
  throw new DatabaseError('Something went wrong saving your data. Please try again.');
}

export class SupabaseResumeRepository implements ResumeRepository {
  async saveResume(input: {
    content: string;
    format: CvFormat;
    identity: IdentityHeader;
    originalFilename?: string;
    redactedIdCount?: number;
  }): Promise<StoredResume> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('resumes')
      .insert({
        content: input.content,
        format: input.format,
        identity_header_enc: encryptIdentityHeader(input.identity),
        original_filename: input.originalFilename ?? null,
        redacted_id_count: input.redactedIdCount ?? 0,
      })
      .select('id, created_at, content, format')
      .single();

    if (error || !data) fail('saveResume', error);

    return {
      id: data.id,
      createdAt: new Date(data.created_at),
      content: data.content,
      format: data.format,
    };
  }

  /** Persist the inventory so the review UI can quote evidence back later. */
  async saveInventory(
    resumeId: string,
    inventory: SkillInventory,
  ): Promise<void> {
    const rows: {
      resume_id: string;
      canonical: string;
      surface: string;
      evidence_line: string;
    }[] = [];

    for (const [canonical, evidence] of inventory.evidence) {
      for (const item of evidence) {
        rows.push({
          resume_id: resumeId,
          canonical,
          surface: item.surface,
          evidence_line: item.line,
        });
      }
    }

    if (rows.length === 0) return;

    const supabase = await createClient();
    const { error } = await supabase.from('extracted_skills').insert(rows);
    if (error) fail('saveInventory', error);
  }

  async getResume(id: string): Promise<StoredResume | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('resumes')
      .select('id, created_at, content, format')
      .eq('id', id)
      .maybeSingle();

    // A row belonging to someone else returns null rather than an error:
    // RLS filters it out, so it simply does not exist as far as this caller is
    // concerned. That is the correct answer, and it leaks nothing about
    // whether the id is real.
    if (error) fail('getResume', error);
    if (!data) return null;

    return {
      id: data.id,
      createdAt: new Date(data.created_at),
      content: data.content,
      format: data.format,
    };
  }

  /**
   * Decrypted server-side, and only when a document is being assembled. This is
   * the single point at which the withheld identity comes back.
   */
  async getIdentity(resumeId: string): Promise<IdentityHeader | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('resumes')
      .select('identity_header_enc')
      .eq('id', resumeId)
      .maybeSingle();

    if (error) fail('getIdentity', error);
    if (!data) return null;

    try {
      return decryptIdentityHeader(data.identity_header_enc);
    } catch (cause) {
      // Either the key changed or the row was tampered with. Both are bad, and
      // neither should return a half-decrypted name.
      fail('getIdentity/decrypt', cause);
    }
  }

  async listResumes(): Promise<readonly StoredResume[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('resumes')
      .select('id, created_at, content, format')
      .order('created_at', { ascending: false });

    if (error) fail('listResumes', error);

    return (data ?? []).map((row) => ({
      id: row.id,
      createdAt: new Date(row.created_at),
      content: row.content,
      format: row.format,
    }));
  }

  async saveTailoring(input: {
    resumeId: string;
    jobDescriptionId: string;
    draft: TailoredDraft;
    report: IntegrityReport;
  }): Promise<StoredTailoring> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('tailored_resumes')
      .insert({
        resume_id: input.resumeId,
        job_description_id: input.jobDescriptionId,
        draft: input.draft,
        report: input.report,
        status: 'review',
      })
      .select('id, resume_id, created_at, status, draft, report, approved_claims')
      .single();

    if (error || !data) fail('saveTailoring', error);

    return {
      id: data.id,
      resumeId: data.resume_id,
      createdAt: new Date(data.created_at),
      status: data.status,
      draft: data.draft,
      report: data.report,
      approvedClaims: data.approved_claims ?? [],
      gaps: data.draft?.gaps ?? [],
    };
  }

  async setApprovedClaims(
    tailoringId: string,
    canonicalKeys: readonly string[],
  ): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('tailored_resumes')
      .update({ approved_claims: canonicalKeys, status: 'approved' })
      .eq('id', tailoringId);

    if (error) fail('setApprovedClaims', error);
  }

  /**
   * Everything the user has tailored, newest first, with the advert it was
   * tailored against. RLS-scoped, so no user id is needed or accepted.
   */
  async listTailorings(): Promise<readonly StoredTailoringSummary[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('tailored_resumes')
      .select(
        'id, resume_id, created_at, status, draft, report, approved_claims, job_descriptions(title, content)',
      )
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) fail('listTailorings', error);

    return (data ?? []).map((row) => {
      const advert = Array.isArray(row.job_descriptions)
        ? row.job_descriptions[0]
        : row.job_descriptions;

      return {
        id: row.id,
        resumeId: row.resume_id,
        createdAt: new Date(row.created_at),
        status: row.status,
        title: advert?.title ?? null,
        // A short excerpt only. The full advert is not needed to list history,
        // and shipping it to the browser for fifty rows would be waste.
        advertExcerpt: (advert?.content ?? '').slice(0, 160),
        acceptedCount: row.report?.accepted?.length ?? 0,
        borderlineCount: row.report?.borderline?.length ?? 0,
        blockedCount: row.report?.blocked?.length ?? 0,
        approvedCount: row.approved_claims?.length ?? 0,
        gapCount: row.draft?.gaps?.length ?? 0,
      };
    });
  }

  /**
   * Mark a CV as used, so an active user's history is never purged out from
   * under them. Fire and forget: a failed touch is not worth failing a request
   * the user asked for.
   */
  async touchResume(resumeId: string): Promise<void> {
    try {
      const supabase = await createClient();
      await supabase.rpc('touch_resume_access', { p_resume_id: resumeId });
    } catch (cause) {
      console.error('[repo] touchResume failed', cause);
    }
  }

  async getTailoring(id: string): Promise<StoredTailoring | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('tailored_resumes')
      .select('id, resume_id, created_at, status, draft, report, approved_claims')
      .eq('id', id)
      .maybeSingle();

    if (error) fail('getTailoring', error);
    if (!data) return null;

    return {
      id: data.id,
      resumeId: data.resume_id,
      createdAt: new Date(data.created_at),
      status: data.status,
      draft: data.draft,
      report: data.report,
      approvedClaims: data.approved_claims ?? [],
      gaps: data.draft?.gaps ?? [],
    };
  }

  /**
   * POPIA §24, the database half. Deleting the auth user is the other half and
   * needs admin privileges, so it lives in the account-deletion action. Every
   * table cascades from auth.users, so this is belt to that braces: it makes
   * the rows go away even if auth deletion is what fails.
   */
  async deleteEverything(): Promise<void> {
    const supabase = await createClient();

    // Ordered children-first, though the cascades would handle it anyway.
    for (const table of [
      'tailored_resumes',
      'extracted_skills',
      'job_descriptions',
      'resumes',
      'consent_records',
    ] as const) {
      const { error } = await supabase
        .from(table)
        .delete()
        .not('id', 'is', null);
      if (error) fail(`deleteEverything/${table}`, error);
    }
  }
}

export const resumeRepository = new SupabaseResumeRepository();
