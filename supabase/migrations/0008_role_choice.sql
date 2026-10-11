-- Make "which side are you on" a real choice.
--
-- `role` arrived in migration 0005 as `not null default 'candidate'`, and that
-- default had a consequence nobody asked for. Every new account was already a
-- candidate, so there was no state meaning "has not answered yet", so the
-- onboarding screen had nothing to trigger on and was never reached by anyone.
-- The only way to become a recruiter was to update the row by hand, which is
-- how the demonstration recruiter was created.
--
-- Dropping the default and the not-null gives that state a representation.
-- Null means unanswered, and the dashboard sends a null-role account to
-- /onboarding.
--
-- Three things this deliberately does not touch:
--
--   * Existing rows. They keep the value they already hold, so nobody
--     currently signed in is asked the question again, and the recruiter
--     account stays a recruiter.
--
--   * The policies in 0005. `is_recruiter()` compares the column against
--     'recruiter', and a null role is not equal to it, so an account that has
--     not chosen is refused the recruiter-only inserts exactly as a candidate
--     would be. That is the behaviour we want, and it falls out of SQL's null
--     semantics rather than needing a new branch.
--
--   * handle_new_user() in 0001, which inserts only (id, email). That insert
--     used to pick up 'candidate' from the default and now leaves the column
--     null. That is the whole point of this migration.

alter table public.profiles
  alter column role drop default;

alter table public.profiles
  alter column role drop not null;

comment on column public.profiles.role is
  'Which side of the hire this account is on. Null means they have not been asked yet; the application routes those accounts to onboarding.';
