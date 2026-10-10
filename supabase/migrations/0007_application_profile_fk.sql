-- Let an application reach the applicant's profile.
--
-- `applications.candidate_id` references auth.users, which is right: that is
-- what makes a deleted account take its applications with it. But auth.users
-- is not in the public schema, so PostgREST cannot follow it, and a recruiter
-- listing applicants could not ask for the applicant's name in the same query
-- as the application.
--
-- The fix is a second foreign key to profiles. It is not a duplicate of the
-- first: profiles.id is itself auth.users.id, so the two constraints say the
-- same thing about the data and different things about what can be joined.
--
-- The cascade is declared on both for the same reason as everywhere else in
-- this schema: deleting the auth user must leave nothing behind.
--
-- This changes no policy. A recruiter can still read only the profiles of
-- people who applied to a job they own, which is enforced by the
-- `profiles: recruiter reads own applicants` policy in 0005.

alter table public.applications
  add constraint applications_candidate_profile_fkey
  foreign key (candidate_id)
  references public.profiles (id)
  on delete cascade;

comment on constraint applications_candidate_profile_fkey on public.applications is
  'Exists so the applicant''s name can be read in the same query as their application. The access rule is the policy, not this constraint.';
