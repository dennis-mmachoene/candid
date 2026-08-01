/**
 * The database schema, as TypeScript.
 *
 * Until this file existed, `supabase.from('resumes')` returned `any`. A typo in
 * a column name compiled cleanly and failed at runtime, in production, on
 * somebody's CV. The independent audit flagged it after Phase 2 and it survived
 * three more phases. This closes it.
 *
 * **Hand-written from the migrations, not generated.** Generating requires a
 * live project, which the build environment does not have. That makes this file
 * capable of drifting from reality, which is a real risk and the reason to
 * regenerate it properly at the first opportunity:
 *
 *     npx supabase gen types typescript --project-id <ref> > lib/database.types.ts
 *
 * Until then, treat a change to `supabase/migrations/` as a change to this file
 * too. If the two disagree, this file is wrong.
 *
 * Note what is absent, as everywhere else: there is no `id_number` column, in
 * any table, and there never will be.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TailoringStatus = 'review' | 'approved' | 'exported' | 'blocked';
export type CvFormatEnum = 'pdf' | 'docx';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          updated_at: string;
          default_template: string;
        };
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
          updated_at?: string;
          default_template?: string;
        };
        Update: {
          email?: string;
          updated_at?: string;
          default_template?: string;
        };
        Relationships: [];
      };

      consent_records: {
        Row: {
          id: string;
          user_id: string;
          policy_version: string;
          accepted_at: string;
          operators: Json;
        };
        Insert: {
          id?: string;
          user_id?: string;
          policy_version: string;
          accepted_at?: string;
          operators: Json;
        };
        // Deliberately never updatable. A consent record that can be edited
        // after the fact is not evidence of anything, and the migration grants
        // no UPDATE policy.
        Update: never;
        Relationships: [];
      };

      resumes: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          last_accessed_at: string;
          format: CvFormatEnum;
          original_filename: string | null;
          content: string;
          identity_header_enc: string;
          redacted_id_count: number;
        };
        Insert: {
          id?: string;
          user_id?: string;
          created_at?: string;
          last_accessed_at?: string;
          format: CvFormatEnum;
          original_filename?: string | null;
          content: string;
          identity_header_enc: string;
          redacted_id_count?: number;
        };
        Update: {
          last_accessed_at?: string;
          content?: string;
          identity_header_enc?: string;
        };
        Relationships: [];
      };

      extracted_skills: {
        Row: {
          id: string;
          user_id: string;
          resume_id: string;
          canonical: string;
          surface: string;
          evidence_line: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          resume_id: string;
          canonical: string;
          surface: string;
          evidence_line: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };

      job_descriptions: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          title: string | null;
          content: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          created_at?: string;
          title?: string | null;
          content: string;
        };
        Update: never;
        Relationships: [];
      };

      tailored_resumes: {
        Row: {
          id: string;
          user_id: string;
          resume_id: string;
          job_description_id: string;
          created_at: string;
          status: TailoringStatus;
          draft: Json;
          report: Json;
          approved_claims: Json;
          template_id: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          resume_id: string;
          job_description_id: string;
          created_at?: string;
          status?: TailoringStatus;
          draft: Json;
          report: Json;
          approved_claims?: Json;
          template_id?: string;
        };
        Update: {
          status?: TailoringStatus;
          approved_claims?: Json;
          template_id?: string;
        };
        Relationships: [];
      };

      audit_logs: {
        Row: {
          id: number;
          user_id: string;
          action: string;
          created_at: string;
          metadata: Json;
        };
        // No INSERT policy exists. Writes go through log_audit_event(), a
        // SECURITY DEFINER function, so a forgeable audit trail does not exist.
        Insert: never;
        Update: never;
        Relationships: [];
      };

      rate_limits: {
        Row: {
          user_id: string;
          action: string;
          window_start: string;
          count: number;
        };
        // RLS is enabled on this table with zero policies, so nothing a user
        // sends can read or write it. The types say the same thing the
        // database says.
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };

    Views: Record<string, never>;

    Functions: {
      consume_rate_limit: {
        Args: {
          p_action: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      log_audit_event: {
        Args: { p_action: string; p_metadata?: Json };
        Returns: undefined;
      };
      touch_resume_access: {
        Args: { p_resume_id: string };
        Returns: undefined;
      };
      /**
       * Revoked from `authenticated`. Present here for completeness; calling it
       * from the app would fail, which is the intent.
       */
      purge_inactive_data: {
        Args: Record<string, never>;
        Returns: { resumes_deleted: number; adverts_deleted: number }[];
      };
    };

    Enums: {
      tailoring_status: TailoringStatus;
      cv_format: CvFormatEnum;
    };

    CompositeTypes: Record<string, never>;
  };
}
