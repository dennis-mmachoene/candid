import 'server-only';

import { createClient } from './supabase/server';
import { DatabaseError } from './supabase-repo';
import type { Database } from '@/lib/database.types';

/**
 * The job board: listings, applications and the recruiter's side of them.
 *
 * There is no port for this, and that is deliberate rather than an oversight.
 * A port exists where the domain owns a rule worth protecting from the
 * infrastructure that serves it. The tailoring engine has such rules, so it
 * has `AIProvider` and `ResumeRepository`. Posting a job and listing the people
 * who applied to it have none: they are reads and writes, and the only rules
 * that apply to them live in the database as Row-Level Security, where they
 * cannot be forgotten by a caller.
 *
 * That last point is worth stating plainly. Nothing in this file filters by
 * user. There is no `where user_id = ...` anywhere below, because every policy
 * in migration 0005 has already done it. A recruiter reading applications gets
 * their own jobs' applications; a candidate gets their own. If a query here
 * were wrong, it would return nothing rather than someone else's data.
 */

type ApplicationStatus = Database['public']['Enums']['application_status'];
type ApplicationMode = Database['public']['Enums']['application_mode'];
type UserRole = Database['public']['Enums']['user_role'];

export type { ApplicationStatus, ApplicationMode, UserRole };

function fail(operation: string, cause: unknown): never {
  console.error(`[jobs] ${operation} failed`, cause);
  throw new DatabaseError('Something went wrong. Please try again.');
}

// ---------------------------------------------------------------------------
// Shapes the pages read
// ---------------------------------------------------------------------------

export interface JobSummary {
  id: string;
  title: string;
  location: string;
  companyName: string;
  companyLogo: string | null;
  packageMin: number | null;
  packageMax: number | null;
  isOpen: boolean;
  createdAt: Date;
}

export interface JobDetail extends JobSummary {
  description: string;
  requirements: string;
  recruiterId: string;
}

export interface MyApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  mode: ApplicationMode;
  status: ApplicationStatus;
  tailoredResumeId: string | null;
  createdAt: Date;
}

export interface Applicant {
  id: string;
  candidateId: string;
  fullName: string | null;
  headline: string | null;
  location: string | null;
  mode: ApplicationMode;
  status: ApplicationStatus;
  resumeId: string | null;
  tailoredResumeId: string | null;
  createdAt: Date;
}

export interface RecruiterJob extends JobSummary {
  applicantCount: number;
}

// Supabase returns an embedded one-to-one as an object, but its generated
// types widen it to an array in some query shapes. This narrows it back
// without an `any`.
function one<T>(value: T | T[] | null): T | null {
  if (value === null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// ---------------------------------------------------------------------------
// Browsing
// ---------------------------------------------------------------------------

export const jobRepository = {
  /**
   * Open jobs, newest first, optionally filtered by a search term.
   *
   * The search matches the title and the location rather than the full
   * description. Matching the description sounds more helpful and is not: a
   * description mentioning "no Kubernetes experience required" would surface
   * for a Kubernetes search.
   */
  async listJobs(search?: string): Promise<readonly JobSummary[]> {
    const supabase = await createClient();

    let query = supabase
      .from('jobs')
      .select(
        'id, title, location, package_min, package_max, is_open, created_at, companies(name, logo_url)',
      )
      .eq('is_open', true)
      .order('created_at', { ascending: false })
      .limit(60);

    const term = search?.trim();
    if (term) {
      query = query.or(`title.ilike.%${term}%,location.ilike.%${term}%`);
    }

    const { data, error } = await query;
    if (error) fail('listJobs', error);

    return (data ?? []).map((row) => {
      const company = one(row.companies);
      return {
        id: row.id,
        title: row.title,
        location: row.location,
        companyName: company?.name ?? 'Unknown company',
        companyLogo: company?.logo_url ?? null,
        packageMin: row.package_min,
        packageMax: row.package_max,
        isOpen: row.is_open,
        createdAt: new Date(row.created_at),
      };
    });
  },

  async getJob(id: string): Promise<JobDetail | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('jobs')
      .select(
        'id, title, location, description, requirements, package_min, package_max, is_open, created_at, recruiter_id, companies(name, logo_url)',
      )
      .eq('id', id)
      .maybeSingle();

    if (error) fail('getJob', error);
    if (!data) return null;

    const company = one(data.companies);
    return {
      id: data.id,
      title: data.title,
      location: data.location,
      description: data.description,
      requirements: data.requirements,
      companyName: company?.name ?? 'Unknown company',
      companyLogo: company?.logo_url ?? null,
      packageMin: data.package_min,
      packageMax: data.package_max,
      isOpen: data.is_open,
      recruiterId: data.recruiter_id,
      createdAt: new Date(data.created_at),
    };
  },

  // -------------------------------------------------------------------------
  // The shortlist
  // -------------------------------------------------------------------------

  /**
   * Which of the caller's saved jobs to mark on the board.
   *
   * A set of ids rather than the jobs themselves, because the board already
   * has the jobs. Asking for the full rows again to find out which ones carry
   * a filled bookmark would be a second copy of the same data.
   *
   * No user filter, here or anywhere below. The three policies on saved_jobs
   * all key on `auth.uid()`, so the caller cannot see or touch another
   * person's shortlist whatever this file asks for.
   */
  async savedJobIds(): Promise<ReadonlySet<string>> {
    const supabase = await createClient();
    const { data, error } = await supabase.from('saved_jobs').select('job_id');

    if (error) fail('savedJobIds', error);
    return new Set((data ?? []).map((row) => row.job_id));
  },

  /**
   * The shortlist itself, most recently saved first.
   *
   * Ordered by when it was saved rather than when it was posted, because a
   * shortlist is a record of the person's own decisions and the order they
   * made them in is the order they remember.
   *
   * Closed roles are deliberately not filtered out. A job the employer has
   * since closed still belongs on a shortlist the person built, and the card
   * carries a Closed badge. Silently dropping it would look like the save
   * never worked.
   */
  async listSavedJobs(): Promise<readonly JobSummary[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('saved_jobs')
      .select(
        'job_id, created_at, jobs(id, title, location, package_min, package_max, is_open, created_at, companies(name, logo_url))',
      )
      .order('created_at', { ascending: false })
      .limit(60);

    if (error) fail('listSavedJobs', error);

    return (data ?? []).flatMap((row) => {
      const job = one(row.jobs);
      // A row whose job has been deleted cannot happen: the foreign key
      // cascades. flatMap rather than map because the embed is typed as
      // nullable regardless, and inventing a placeholder job would be worse
      // than omitting one.
      if (!job) return [];

      const company = one(job.companies);
      return [
        {
          id: job.id,
          title: job.title,
          location: job.location,
          companyName: company?.name ?? 'Unknown company',
          companyLogo: company?.logo_url ?? null,
          packageMin: job.package_min,
          packageMax: job.package_max,
          isOpen: job.is_open,
          createdAt: new Date(job.created_at),
        },
      ];
    });
  },

  /**
   * Save or unsave a job.
   *
   * `user_id` is never sent. The column defaults to `auth.uid()` and the
   * insert policy checks it, so a request that tried to save a job onto
   * somebody else's shortlist would be refused by the database rather than
   * trusted by this function.
   *
   * A duplicate save is treated as success. The table's unique constraint on
   * (user_id, job_id) is what makes saving twice a no-op, and 23505 is
   * Postgres saying the row the caller wanted is already there. Surfacing that
   * as an error would mean a double click reads as a failure.
   */
  async setSaved(jobId: string, saved: boolean): Promise<void> {
    const supabase = await createClient();

    if (!saved) {
      const { error } = await supabase
        .from('saved_jobs')
        .delete()
        .eq('job_id', jobId);

      if (error) fail('unsaveJob', error);
      return;
    }

    const { error } = await supabase.from('saved_jobs').insert({ job_id: jobId });

    if (error && error.code !== '23505') fail('saveJob', error);
  },

  // -------------------------------------------------------------------------
  // Applying
  // -------------------------------------------------------------------------

  /**
   * Has this candidate already applied to this job?
   *
   * The database enforces one application per candidate per job with a unique
   * constraint, so this is for the interface rather than for correctness: it
   * is the difference between a disabled button and a constraint violation.
   */
  async existingApplication(jobId: string): Promise<MyApplication | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('applications')
      .select(
        'id, job_id, mode, status, tailored_resume_id, created_at, jobs(title, companies(name))',
      )
      .eq('job_id', jobId)
      .maybeSingle();

    if (error) fail('existingApplication', error);
    if (!data) return null;

    const job = one(data.jobs);
    return {
      id: data.id,
      jobId: data.job_id,
      jobTitle: job?.title ?? '',
      companyName: one(job?.companies ?? null)?.name ?? '',
      mode: data.mode,
      status: data.status,
      tailoredResumeId: data.tailored_resume_id,
      createdAt: new Date(data.created_at),
    };
  },

  async apply(input: {
    jobId: string;
    mode: ApplicationMode;
    resumeId?: string;
    tailoredResumeId?: string;
    note?: string;
  }): Promise<string> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('applications')
      .insert({
        job_id: input.jobId,
        mode: input.mode,
        resume_id: input.resumeId ?? null,
        tailored_resume_id: input.tailoredResumeId ?? null,
        note: input.note ?? null,
      })
      .select('id')
      .single();

    if (error || !data) fail('apply', error);
    return data.id;
  },

  async myApplications(): Promise<readonly MyApplication[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('applications')
      .select(
        'id, job_id, mode, status, tailored_resume_id, created_at, jobs(title, companies(name))',
      )
      .order('created_at', { ascending: false });

    if (error) fail('myApplications', error);

    return (data ?? []).map((row) => {
      const job = one(row.jobs);
      return {
        id: row.id,
        jobId: row.job_id,
        jobTitle: job?.title ?? 'A job that has since been removed',
        companyName: one(job?.companies ?? null)?.name ?? '',
        mode: row.mode,
        status: row.status,
        tailoredResumeId: row.tailored_resume_id,
        createdAt: new Date(row.created_at),
      };
    });
  },

  // -------------------------------------------------------------------------
  // The recruiter's side
  // -------------------------------------------------------------------------

  async listCompanies(): Promise<readonly { id: string; name: string }[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('companies')
      .select('id, name')
      .order('name');

    if (error) fail('listCompanies', error);
    return data ?? [];
  },

  /** Find a company by name or create it. Recruiters should not hunt for an id. */
  async findOrCreateCompany(name: string): Promise<string> {
    const supabase = await createClient();

    const { data: found, error: findError } = await supabase
      .from('companies')
      .select('id')
      .ilike('name', name.trim())
      .maybeSingle();

    if (findError) fail('findCompany', findError);
    if (found) return found.id;

    const { data, error } = await supabase
      .from('companies')
      .insert({ name: name.trim() })
      .select('id')
      .single();

    if (error || !data) fail('createCompany', error);
    return data.id;
  },

  async createJob(input: {
    companyId: string;
    title: string;
    location: string;
    description: string;
    requirements: string;
    packageMin?: number | null;
    packageMax?: number | null;
  }): Promise<string> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('jobs')
      .insert({
        company_id: input.companyId,
        title: input.title,
        location: input.location,
        description: input.description,
        requirements: input.requirements,
        package_min: input.packageMin ?? null,
        package_max: input.packageMax ?? null,
      })
      .select('id')
      .single();

    if (error || !data) fail('createJob', error);
    return data.id;
  },

  /**
   * The recruiter's own jobs, with how many people applied to each.
   *
   * The count comes back from PostgREST as an aggregate rather than as a
   * second round trip, which matters on a dashboard that lists every job.
   */
  async listMyJobs(): Promise<readonly RecruiterJob[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('jobs')
      .select(
        'id, title, location, package_min, package_max, is_open, created_at, companies(name, logo_url), applications(count)',
      )
      .order('created_at', { ascending: false });

    if (error) fail('listMyJobs', error);

    return (data ?? []).map((row) => {
      const company = one(row.companies);
      const counts = row.applications as unknown as { count: number }[] | null;
      return {
        id: row.id,
        title: row.title,
        location: row.location,
        companyName: company?.name ?? 'Unknown company',
        companyLogo: company?.logo_url ?? null,
        packageMin: row.package_min,
        packageMax: row.package_max,
        isOpen: row.is_open,
        createdAt: new Date(row.created_at),
        applicantCount: counts?.[0]?.count ?? 0,
      };
    });
  },

  /**
   * Who applied to one of the recruiter's jobs.
   *
   * The applicant's name comes from their profile, which the recruiter can
   * read only because they applied: see the `profiles: recruiter reads own
   * applicants` policy in 0005. There is no join here that the database would
   * not already have permitted.
   */
  async listApplicants(jobId: string): Promise<readonly Applicant[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('applications')
      .select(
        'id, candidate_id, mode, status, resume_id, tailored_resume_id, created_at, profiles(full_name, headline, location)',
      )
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (error) fail('listApplicants', error);

    return (data ?? []).map((row) => {
      const profile = one(row.profiles);
      return {
        id: row.id,
        candidateId: row.candidate_id,
        fullName: profile?.full_name ?? null,
        headline: profile?.headline ?? null,
        location: profile?.location ?? null,
        mode: row.mode,
        status: row.status,
        resumeId: row.resume_id,
        tailoredResumeId: row.tailored_resume_id,
        createdAt: new Date(row.created_at),
      };
    });
  },

  async setApplicationStatus(
    applicationId: string,
    status: ApplicationStatus,
  ): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('applications')
      .update({ status })
      .eq('id', applicationId);

    if (error) fail('setApplicationStatus', error);
  },

  // -------------------------------------------------------------------------
  // Role
  // -------------------------------------------------------------------------

  /**
   * The caller's role, or null when they have not chosen one yet.
   *
   * This is the one read in the whole repository that must not throw. The site
   * header calls it on every page, so an exception here is a 500 on every
   * route at once rather than a broken corner of one screen. A sleeping
   * database or a dropped connection is exactly when that must not happen.
   *
   * Null is also what a brand-new account legitimately returns, and the header
   * already handles null by showing the job seeker's navigation. Degrading to
   * that is correct: a recruiter seeing the wrong menu for one page load is a
   * smaller failure than nobody being able to load anything.
   */
  async getRole(): Promise<UserRole | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .maybeSingle();

    if (error) {
      console.error('[jobs] getRole failed', error);
      return null;
    }

    return data?.role ?? null;
  },

  async setRole(role: UserRole): Promise<void> {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', auth.user.id);

    if (error) fail('setRole', error);
  },
};
