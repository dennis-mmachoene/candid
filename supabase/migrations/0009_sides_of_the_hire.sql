-- ---------------------------------------------------------------------------
-- 0009: the candidate half of the role split
--
-- Migration 0005 wrote the employer half and stopped there. `is_recruiter()`
-- guards posting a job and creating a company, so a job seeker who reaches the
-- posting form gets nothing written no matter what they submit.
--
-- There was no mirror of it. `applications: candidate applies` checked that
-- you were applying as yourself and that the role was open, and nothing
-- checked which side of the hire you were on. An employer could apply to a
-- vacancy, including their own, and the row would have been written.
--
-- That is not a leak. Nobody else's data was reachable through it. It is an
-- integrity hole: the applications table is supposed to mean "a job seeker
-- answered this advert", and without this it could hold rows that mean
-- something else.
--
-- The interface now refuses both directions before a form is ever shown, in
-- lib/guards.ts. This migration is what answers a request that did not come
-- through a page.
-- ---------------------------------------------------------------------------

-- The mirror of is_recruiter. SECURITY DEFINER for the same reason: answering
-- "is the caller a job seeker" must not require the caller to be able to read
-- the profiles table.
create or replace function public.is_candidate()
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
      and role = 'candidate'
  );
$$;

comment on function public.is_candidate is
  'True when the calling user is a job seeker. The mirror of is_recruiter, and what stops an employer applying to a vacancy.';

-- An account with no role yet is neither, so both functions return false and
-- neither side of the board will accept a write from it. That is correct: the
-- interface sends such an account to /onboarding before it can try.

-- ---------------------------------------------------------------------------
-- applying
-- ---------------------------------------------------------------------------

drop policy "applications: candidate applies" on public.applications;

create policy "applications: candidate applies"
  on public.applications for insert
  to authenticated
  with check (
    public.is_candidate()
    and (select auth.uid()) = candidate_id
    and exists (
      select 1 from public.jobs j
      where j.id = job_id and j.is_open
    )
  );

-- Rows written before this migration are left alone. The policy governs new
-- inserts, and rewriting history to match a rule that did not exist when the
-- row was made would be the wrong kind of tidy.

-- ---------------------------------------------------------------------------
-- saving a role for later
-- ---------------------------------------------------------------------------

-- Same reasoning, smaller stakes. A shortlist of roles to come back to is a
-- job seeker's tool. An employer bookmarking vacancies has no screen that
-- would ever show them.

drop policy "saved_jobs: insert own" on public.saved_jobs;

create policy "saved_jobs: insert own"
  on public.saved_jobs for insert
  to authenticated
  with check (
    public.is_candidate()
    and (select auth.uid()) = user_id
  );

-- ---------------------------------------------------------------------------
-- What is deliberately not changed
--
-- `resumes` and `tailored_resumes` stay scoped to their owner and nothing
-- more. An employer who uploads their own CV and tailors it is using the tool
-- on their own data, harms nobody, and is told plainly by the interface that
-- the page is not for them. Adding is_candidate() there would buy no safety
-- and would make the test suite depend on a role choice to exercise the
-- tailoring engine, which has nothing to do with the job board.
-- ---------------------------------------------------------------------------
