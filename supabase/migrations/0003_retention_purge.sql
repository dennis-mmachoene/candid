-- Retention.
--
-- Keeping a job seeker's CV forever because nobody wrote the deletion job is
-- the ordinary way privacy promises decay. POPIA §14 requires that records not
-- be retained longer than necessary for the purpose they were collected for.
--
-- The period is TWELVE MONTHS of inactivity, and it is documented in three
-- places on purpose: here, in the privacy policy, and in the consent notice the
-- user actually reads. A retention period nobody is told about is not a policy,
-- it is a habit.
--
-- Twelve months rather than three: job searches are long, people come back to a
-- CV they wrote last year, and a tool that silently deletes their work after a
-- quarter would be worse than useless to the people this is built for.

-- ---------------------------------------------------------------------------
-- Activity tracking
-- ---------------------------------------------------------------------------

-- `resumes.last_accessed_at` already exists. Touch it whenever a CV is used
-- for something, so that an active user's history is never purged out from
-- under them.
create or replace function public.touch_resume_access(p_resume_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- SECURITY INVOKER, deliberately: this runs as the caller, so RLS applies
  -- and a user cannot keep somebody else's data alive by touching their id.
  update public.resumes
  set last_accessed_at = now()
  where id = p_resume_id;
end;
$$;

grant execute on function public.touch_resume_access(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The purge
-- ---------------------------------------------------------------------------

create or replace function public.purge_inactive_data()
returns table (resumes_deleted integer, adverts_deleted integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff     timestamptz := now() - interval '12 months';
  v_resumes    integer;
  v_adverts    integer;
begin
  -- extracted_skills and tailored_resumes cascade from resumes, so this one
  -- delete removes the whole tree.
  with removed as (
    delete from public.resumes
    where last_accessed_at < v_cutoff
    returning 1
  )
  select count(*) into v_resumes from removed;

  -- Adverts are not owned by a resume, so they need their own sweep. Only
  -- those with no surviving tailoring are removed.
  with removed as (
    delete from public.job_descriptions jd
    where jd.created_at < v_cutoff
      and not exists (
        select 1 from public.tailored_resumes tr
        where tr.job_description_id = jd.id
      )
    returning 1
  )
  select count(*) into v_adverts from removed;

  -- Audit logs are kept longer than content on purpose: they hold no CV text
  -- and no identity, only actions and counts, and they are the record of what
  -- was done to whom. Two years, then gone.
  delete from public.audit_logs
  where created_at < now() - interval '24 months';

  -- Rate limit windows are worthless after they close.
  delete from public.rate_limits
  where window_start < now() - interval '7 days';

  resumes_deleted := v_resumes;
  adverts_deleted := v_adverts;
  return next;
end;
$$;

comment on function public.purge_inactive_data is
  'Deletes resumes untouched for 12 months and everything cascading from them, adverts with no surviving tailoring, audit logs older than 24 months, and closed rate-limit windows. SECURITY DEFINER because it must reach across all users; it takes no arguments, so there is nothing a caller could point it at.';

-- Nobody but the scheduler calls this.
revoke all on function public.purge_inactive_data() from public;
revoke all on function public.purge_inactive_data() from authenticated;
revoke all on function public.purge_inactive_data() from anon;

-- ---------------------------------------------------------------------------
-- Schedule
-- ---------------------------------------------------------------------------

-- Enable pg_cron in the Supabase dashboard first:
--   Database -> Extensions -> pg_cron -> enable
-- then run the block below. It is separated because `create extension` needs
-- privileges the SQL editor may not have depending on your project settings.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Unschedule first so re-running this migration does not stack duplicates.
    perform cron.unschedule('candid-retention-purge')
    where exists (
      select 1 from cron.job where jobname = 'candid-retention-purge'
    );

    -- 03:15 UTC daily, which is a quiet hour in South Africa (05:15 SAST).
    perform cron.schedule(
      'candid-retention-purge',
      '15 3 * * *',
      $job$ select public.purge_inactive_data(); $job$
    );
  else
    raise notice 'pg_cron is not enabled. Enable it under Database -> Extensions, then re-run this migration to schedule the retention purge.';
  end if;
end;
$$;
