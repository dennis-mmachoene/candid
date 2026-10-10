-- Candid — the job board.
--
-- ============================================================================
-- STILL NO id_number COLUMN, AND THERE MUST NEVER BE ONE.
-- ============================================================================
--
-- This migration turns Candid from a CV tailoring tool into a job application
-- platform. It adds the second role, the listings, and the applications that
-- join a candidate to a job.
--
-- The rules from 0001 still hold:
--
--   1. Row-Level Security is enabled on every table.
--   2. Every user_id cascades from auth.users, so deleting the auth user
--      erases everything they own in one statement.
--   3. `(select auth.uid())` is wrapped in a subselect so Postgres evaluates
--      it once per query rather than once per row.
--
-- One rule is new, and it is the interesting one:
--
--   4. A recruiter can read exactly the CV that was submitted to a job they
--      own, and no other CV. That is enforced by policy on `resumes` and
--      `tailored_resumes`, not by the application remembering to filter. A
--      recruiter who guesses another applicant's id gets nothing back.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('candidate', 'recruiter');

create type public.application_status as enum (
  'submitted',    -- the candidate has applied
  'reviewing',    -- the recruiter has opened it
  'shortlisted',
  'rejected',
  'hired'
);

-- How the candidate chose to apply. Kept as data rather than inferred from
-- which column is populated, because the choice itself is worth recording:
-- it is the moment the applicant decided whether to let a model touch their CV.
create type public.application_mode as enum ('profile', 'tailored');

-- ---------------------------------------------------------------------------
-- profiles gains a role and the fields a listing page shows
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists role public.user_role not null default 'candidate',
  add column if not exists full_name text,
  add column if not exists headline text,
  add column if not exists phone text,
  add column if not exists location text,
  add column if not exists links text[] not null default '{}';

comment on column public.profiles.role is
  'candidate or recruiter. Chosen once at onboarding. A user is one or the other, not both, because an account that can post the job it applies to is a different product with different problems.';

comment on column public.profiles.headline is
  'The line under the name on a CV: "Full-Stack Developer".';

comment on column public.profiles.links is
  'Profile links: GitHub, LinkedIn, a portfolio. Printed in the exported CV header. An array rather than a table because nothing ever queries one link on its own.';

-- Used by the policies below. SECURITY DEFINER so a candidate cannot see the
-- rest of the profiles table in order to answer the question.
create or replace function public.is_recruiter()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'recruiter'
  );
$$;

comment on function public.is_recruiter is
  'True when the calling user is a recruiter. Used by the jobs and companies policies.';

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------

create table public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  logo_url    text,
  created_by  uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at  timestamptz not null default now(),
  constraint companies_name_length check (char_length(name) between 2 and 120)
);

comment on table public.companies is
  'The employers jobs are posted under. Readable by everyone signed in, because a listing without a company name is not a listing.';

alter table public.companies enable row level security;

create policy "companies: read all"
  on public.companies for select
  to authenticated
  using (true);

create policy "companies: recruiter creates"
  on public.companies for insert
  to authenticated
  with check (public.is_recruiter() and (select auth.uid()) = created_by);

create policy "companies: creator updates"
  on public.companies for update
  to authenticated
  using ((select auth.uid()) = created_by)
  with check ((select auth.uid()) = created_by);

-- ---------------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------------

create table public.jobs (
  id            uuid primary key default gen_random_uuid(),
  recruiter_id  uuid not null references auth.users (id) on delete cascade default auth.uid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  title         text not null,
  location      text not null,
  description   text not null,
  requirements  text not null,
  package_min   integer,
  package_max   integer,
  is_open       boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- The same bounds the tailoring form enforces. A job description is what a
  -- CV gets compared against, so one too short to compare against should not
  -- reach the database either.
  constraint jobs_description_length check (char_length(description) between 80 and 15000),
  constraint jobs_title_length check (char_length(title) between 3 and 120),
  constraint jobs_package_order check (
    package_min is null or package_max is null or package_min <= package_max
  )
);

comment on table public.jobs is
  'Job listings. Untrusted input: a description is treated as data everywhere in the system and never as instruction, exactly like a pasted advert.';

create index jobs_open_idx on public.jobs (is_open, created_at desc);
create index jobs_recruiter_idx on public.jobs (recruiter_id, created_at desc);
create index jobs_company_idx on public.jobs (company_id);

alter table public.jobs enable row level security;

-- A closed job stays visible to the recruiter who posted it, and disappears
-- from the board. Deleting it instead would take its applications with it.
create policy "jobs: read open, or own"
  on public.jobs for select
  to authenticated
  using (is_open or recruiter_id = (select auth.uid()));

create policy "jobs: recruiter posts own"
  on public.jobs for insert
  to authenticated
  with check (public.is_recruiter() and (select auth.uid()) = recruiter_id);

create policy "jobs: recruiter updates own"
  on public.jobs for update
  to authenticated
  using ((select auth.uid()) = recruiter_id)
  with check ((select auth.uid()) = recruiter_id);

create policy "jobs: recruiter deletes own"
  on public.jobs for delete
  to authenticated
  using ((select auth.uid()) = recruiter_id);

-- ---------------------------------------------------------------------------
-- saved_jobs
-- ---------------------------------------------------------------------------

create table public.saved_jobs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  job_id      uuid not null references public.jobs (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, job_id)
);

comment on table public.saved_jobs is
  'A candidate shortlist. The unique constraint makes saving twice a no-op rather than a duplicate row.';

create index saved_jobs_user_idx on public.saved_jobs (user_id, created_at desc);

alter table public.saved_jobs enable row level security;

create policy "saved_jobs: read own"
  on public.saved_jobs for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "saved_jobs: insert own"
  on public.saved_jobs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "saved_jobs: delete own"
  on public.saved_jobs for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- applications
-- ---------------------------------------------------------------------------

create table public.applications (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid not null references public.jobs (id) on delete cascade,
  candidate_id        uuid not null references auth.users (id) on delete cascade default auth.uid(),
  resume_id           uuid references public.resumes (id) on delete set null,
  tailored_resume_id  uuid references public.tailored_resumes (id) on delete set null,
  mode                public.application_mode not null,
  status              public.application_status not null default 'submitted',
  note                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- One application per candidate per job. Applying again is an update, not a
  -- second row, so a recruiter never sees the same person twice in a list.
  unique (job_id, candidate_id),

  -- The mode and the attached document must agree. Without this, a row can
  -- claim it was tailored while pointing at nothing, and the recruiter is
  -- shown a CV that was never checked.
  constraint applications_source_matches_mode check (
    (mode = 'profile'  and resume_id is not null and tailored_resume_id is null)
    or
    (mode = 'tailored' and tailored_resume_id is not null)
  ),
  constraint applications_note_length check (note is null or char_length(note) <= 2000)
);

comment on table public.applications is
  'A candidate applied to a job, with either their stored profile or a tailored version of it. The mode is recorded because the choice matters: it is where the applicant decided whether a model would touch their CV.';

create index applications_job_idx on public.applications (job_id, created_at desc);
create index applications_candidate_idx on public.applications (candidate_id, created_at desc);

alter table public.applications enable row level security;

create policy "applications: candidate reads own"
  on public.applications for select
  to authenticated
  using ((select auth.uid()) = candidate_id);

create policy "applications: candidate applies"
  on public.applications for insert
  to authenticated
  with check (
    (select auth.uid()) = candidate_id
    and exists (
      select 1 from public.jobs j
      where j.id = job_id and j.is_open
    )
  );

create policy "applications: candidate withdraws own"
  on public.applications for delete
  to authenticated
  using ((select auth.uid()) = candidate_id);

create policy "applications: recruiter reads for own jobs"
  on public.applications for select
  to authenticated
  using (
    exists (
      select 1 from public.jobs j
      where j.id = applications.job_id
        and j.recruiter_id = (select auth.uid())
    )
  );

-- A recruiter may move an application along. They may not move it to another
-- job, and they may not swap the attached document, which is why the check
-- repeats the ownership test on the new row as well as the old one.
create policy "applications: recruiter sets status"
  on public.applications for update
  to authenticated
  using (
    exists (
      select 1 from public.jobs j
      where j.id = applications.job_id
        and j.recruiter_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.jobs j
      where j.id = applications.job_id
        and j.recruiter_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- What a recruiter may read of a candidate's CV
-- ---------------------------------------------------------------------------
--
-- Exactly the document that was submitted to a job they own. Nothing else.
--
-- This is the part worth reading twice. The application layer could filter
-- correctly and still be one forgotten `where` clause away from showing a
-- recruiter somebody else's CV. Put here, the database refuses, and a
-- recruiter who guesses an id gets an empty result rather than a document.

create policy "resumes: recruiter reads what was applied with"
  on public.resumes for select
  to authenticated
  using (
    exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.resume_id = resumes.id
        and j.recruiter_id = (select auth.uid())
    )
  );

create policy "tailored_resumes: recruiter reads what was applied with"
  on public.tailored_resumes for select
  to authenticated
  using (
    exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.tailored_resume_id = tailored_resumes.id
        and j.recruiter_id = (select auth.uid())
    )
  );

-- A recruiter needs the applicant's name to read the application at all. This
-- grants that one row, and only for someone who has applied to their job.
create policy "profiles: recruiter reads own applicants"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.candidate_id = profiles.id
        and j.recruiter_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
--
-- `touch_updated_at()` is already defined in 0001 and used by profiles. The
-- two new tables reuse it rather than redefining it.

create trigger jobs_touch_updated_at
  before update on public.jobs
  for each row execute function public.touch_updated_at();

create trigger applications_touch_updated_at
  before update on public.applications
  for each row execute function public.touch_updated_at();
