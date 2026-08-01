-- Candid — initial schema.
--
-- ============================================================================
-- THERE IS NO id_number COLUMN IN THIS SCHEMA, AND THERE MUST NEVER BE ONE.
--
-- South African ID numbers are redacted out of a CV during parsing and
-- discarded in memory. They are never persisted, never sent to an AI provider,
-- and never returned to the user. If a future migration adds a column to hold
-- one, that migration is wrong, whatever the reason given.
-- ============================================================================
--
-- Three other rules this file enforces:
--
--   1. Row-Level Security is enabled on EVERY table. Enabling it denies by
--      default; each policy then grants back only the requesting user's rows.
--   2. `rate_limits` has no user-facing policy at all, so a user cannot read,
--      reset or tamper with their own counter. It is written only by the
--      SECURITY DEFINER function at the bottom of this file.
--   3. Every user_id cascades from auth.users, so deleting the auth user
--      erases everything they own in one statement (POPIA §24).
--
-- Note on `(select auth.uid())`: wrapping the call in a subselect lets Postgres
-- evaluate it once per query as an InitPlan rather than once per row. This is
-- Supabase's documented recommendation and matters on the history list.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.tailoring_status as enum (
  'review',    -- validated, waiting on the user to approve borderline claims
  'approved',  -- user has made their approval decisions
  'exported',  -- a file has been generated from it
  'blocked'    -- nothing survived validation; there is no honest version
);

create type public.cv_format as enum ('pdf', 'docx');

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  email       text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'One row per signed-in user. Email only — Google returns it and we need it to contact nobody, but it identifies the account.';

alter table public.profiles enable row level security;

create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: insert own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "profiles: delete own"
  on public.profiles for delete
  to authenticated
  using ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- consent_records  (POPIA §18)
-- ---------------------------------------------------------------------------

create table public.consent_records (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade default auth.uid(),
  policy_version  text not null,
  accepted_at     timestamptz not null default now(),
  -- Snapshot of the operators as they were worded when the user accepted.
  -- Keeping the text means we can show exactly what was agreed to, not what
  -- the current code happens to say today.
  operators       jsonb not null
);

comment on table public.consent_records is
  'What each user agreed to, and to which version of the policy. Append-only by design: consent history is evidence, so there is no update policy.';

create index consent_records_user_idx on public.consent_records (user_id, accepted_at desc);

alter table public.consent_records enable row level security;

create policy "consent: read own"
  on public.consent_records for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "consent: insert own"
  on public.consent_records for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Deliberately no UPDATE policy. A consent record that can be edited after the
-- fact is not evidence of anything.

create policy "consent: delete own"
  on public.consent_records for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- resumes
-- ---------------------------------------------------------------------------

create table public.resumes (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at            timestamptz not null default now(),
  last_accessed_at      timestamptz not null default now(),
  format                public.cv_format not null,
  original_filename     text,

  -- De-identified CV text. Header block removed, ID numbers redacted,
  -- residual identifiers scrubbed. This is the only version that exists here
  -- and the only version an AI provider ever sees.
  content               text not null,

  -- Name, email and phone, AES-256-GCM encrypted at the application layer
  -- before they reach the database. A stolen dump yields ciphertext.
  -- Format: base64(iv) . base64(authTag) . base64(ciphertext)
  identity_header_enc   text not null,

  -- How many ID numbers were redacted. A count, never the value.
  redacted_id_count     integer not null default 0
);

comment on table public.resumes is
  'Uploaded CVs, stored de-identified. The original file is deliberately NOT retained: it contains the unredacted ID number and full contact details, and keeping it would undo the redaction we just performed.';

comment on column public.resumes.identity_header_enc is
  'AES-256-GCM ciphertext of the identity header. Encrypted in the application, not by the database, so the key never lives beside the data.';

create index resumes_user_idx on public.resumes (user_id, created_at desc);

alter table public.resumes enable row level security;

create policy "resumes: read own"
  on public.resumes for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "resumes: insert own"
  on public.resumes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "resumes: update own"
  on public.resumes for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "resumes: delete own"
  on public.resumes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- extracted_skills
-- ---------------------------------------------------------------------------

create table public.extracted_skills (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade default auth.uid(),
  resume_id      uuid not null references public.resumes (id) on delete cascade,
  canonical      text not null,
  surface        text not null,
  evidence_line  text not null,
  created_at     timestamptz not null default now()
);

comment on table public.extracted_skills is
  'The verifiable skill inventory built from a CV, with the line each skill was found on. This is what every later claim is judged against, and what lets the review UI show the user why a claim was accepted.';

create index extracted_skills_resume_idx on public.extracted_skills (resume_id);
create index extracted_skills_user_idx on public.extracted_skills (user_id);

alter table public.extracted_skills enable row level security;

create policy "skills: read own"
  on public.extracted_skills for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "skills: insert own"
  on public.extracted_skills for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "skills: delete own"
  on public.extracted_skills for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- job_descriptions
-- ---------------------------------------------------------------------------

create table public.job_descriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at  timestamptz not null default now(),
  title       text,
  -- The pasted advert. Untrusted input: treated as data everywhere, never as
  -- instructions, and delimited before it goes anywhere near a model.
  content     text not null
);

create index job_descriptions_user_idx on public.job_descriptions (user_id, created_at desc);

alter table public.job_descriptions enable row level security;

create policy "adverts: read own"
  on public.job_descriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "adverts: insert own"
  on public.job_descriptions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "adverts: delete own"
  on public.job_descriptions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- tailored_resumes
-- ---------------------------------------------------------------------------

create table public.tailored_resumes (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade default auth.uid(),
  resume_id            uuid not null references public.resumes (id) on delete cascade,
  job_description_id   uuid not null references public.job_descriptions (id) on delete cascade,
  created_at           timestamptz not null default now(),
  status               public.tailoring_status not null default 'review',

  -- What the model returned, after Zod validation at the boundary.
  draft                jsonb not null,

  -- accepted / borderline / blocked, each with the evidence behind it.
  report               jsonb not null,

  -- Canonical keys of the borderline claims the user explicitly approved.
  -- A blocked claim appearing in here changes nothing: the document assembler
  -- reads from `report`, and blocked claims are excluded there regardless.
  approved_claims      jsonb not null default '[]'::jsonb,

  template_id          text not null default 'modern'
);

comment on column public.tailored_resumes.approved_claims is
  'User approvals for borderline claims only. Putting a blocked claim in here has no effect — approval is not the gate, the integrity report is.';

create index tailored_resumes_user_idx on public.tailored_resumes (user_id, created_at desc);
create index tailored_resumes_resume_idx on public.tailored_resumes (resume_id);

alter table public.tailored_resumes enable row level security;

create policy "tailored: read own"
  on public.tailored_resumes for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "tailored: insert own"
  on public.tailored_resumes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "tailored: update own"
  on public.tailored_resumes for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "tailored: delete own"
  on public.tailored_resumes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  action      text not null,
  created_at  timestamptz not null default now(),
  metadata    jsonb not null default '{}'::jsonb
);

comment on table public.audit_logs is
  'Read-only to users. Writes go through log_audit_event(), a SECURITY DEFINER function, so an audit trail a user can forge does not exist.';

create index audit_logs_user_idx on public.audit_logs (user_id, created_at desc);

alter table public.audit_logs enable row level security;

create policy "audit: read own"
  on public.audit_logs for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Deliberately no INSERT, UPDATE or DELETE policy. See log_audit_event() below.

-- ---------------------------------------------------------------------------
-- rate_limits
-- ---------------------------------------------------------------------------

create table public.rate_limits (
  user_id       uuid not null references auth.users (id) on delete cascade,
  action        text not null,
  window_start  timestamptz not null,
  count         integer not null default 0,
  primary key (user_id, action, window_start)
);

comment on table public.rate_limits is
  'RLS is enabled and there is deliberately NOT ONE POLICY on this table. With RLS on and no policy, every statement from anon and authenticated is denied. The only way in is consume_rate_limit(), which is SECURITY DEFINER. A user cannot read, reset or inflate their own allowance.';

alter table public.rate_limits enable row level security;

-- No policies. This is intentional. Do not add one.

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

-- Every SECURITY DEFINER function below sets an empty search_path and
-- schema-qualifies its references. Without that, a caller can create a
-- shadowing object in a schema that comes first on the search path and hijack
-- the elevated privileges.

create or replace function public.consume_rate_limit(
  p_action        text,
  p_limit         integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id      uuid := auth.uid();
  v_window_start timestamptz;
  v_count        integer;
begin
  -- No session, no allowance. Fail closed.
  if v_user_id is null then
    return false;
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits (user_id, action, window_start, count)
  values (v_user_id, p_action, v_window_start, 1)
  on conflict (user_id, action, window_start)
    do update set count = public.rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

comment on function public.consume_rate_limit is
  'Increments and checks the caller''s counter for an action. Returns true if they may proceed. The caller is taken from auth.uid(), never from an argument — accepting a user id here would let anyone spend anyone else''s allowance.';

revoke all on function public.consume_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;


create or replace function public.log_audit_event(
  p_action    text,
  p_metadata  jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return;
  end if;

  insert into public.audit_logs (user_id, action, metadata)
  values (v_user_id, p_action, p_metadata);
end;
$$;

revoke all on function public.log_audit_event(text, jsonb) from public;
grant execute on function public.log_audit_event(text, jsonb) to authenticated;


-- Creates the profile row on first sign-in, so the app never has to.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
