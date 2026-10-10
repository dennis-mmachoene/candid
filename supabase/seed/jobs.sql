-- Seed the job board.
--
-- This is not a migration. It is demonstration data, and it is kept out of
-- supabase/migrations deliberately: a migration describes the shape of the
-- database and should produce the same result on an empty production instance
-- as on a laptop. Rows describing six invented jobs at four invented companies
-- are not that.
--
-- ============================================================================
-- EDIT THIS LINE. It must be the email of the account that will play the
-- recruiter in the demonstration.
-- ============================================================================
--
-- Run it in the Supabase SQL editor. It is safe to run twice: companies are
-- matched by name and jobs by title, so a second run updates rather than
-- duplicates.

do $$
declare
  recruiter_email constant text := 'CHANGE-ME@example.com';
  v_recruiter     uuid;
  kriterion       uuid;
  nedgroup        uuid;
  sandrift        uuid;
  thembi          uuid;
begin
  select id into v_recruiter from auth.users where email = recruiter_email;

  if v_recruiter is null then
    raise exception
      'No account found for %. Sign in with that email once, then run this again.',
      recruiter_email;
  end if;

  -- The account that owns these postings has to be a recruiter, or the
  -- is_recruiter() check on the jobs policy would refuse them in the app.
  update public.profiles set role = 'recruiter' where id = v_recruiter;

  -- --- Companies ------------------------------------------------------------

  insert into public.companies (name, created_by)
  values ('Kriterion', v_recruiter)
  on conflict (name) do update set created_by = excluded.created_by
  returning id into kriterion;

  insert into public.companies (name, created_by)
  values ('Nedgroup Digital', v_recruiter)
  on conflict (name) do update set created_by = excluded.created_by
  returning id into nedgroup;

  insert into public.companies (name, created_by)
  values ('Sandrift Analytics', v_recruiter)
  on conflict (name) do update set created_by = excluded.created_by
  returning id into sandrift;

  insert into public.companies (name, created_by)
  values ('Thembi Health', v_recruiter)
  on conflict (name) do update set created_by = excluded.created_by
  returning id into thembi;

  -- --- Jobs -----------------------------------------------------------------
  --
  -- Six roles, written the way a South African advert is actually written,
  -- because they are what a CV gets compared against. A thin posting produces
  -- a thin tailoring, and a board full of thin postings would demonstrate
  -- nothing.
  --
  -- They are deliberately spread across how well they match a typical backend
  -- CV. The Data Engineer and the Mobile Developer are there to be refused:
  -- a board on which everything matches proves nothing about the checking.

  -- Qualified on purpose. An unqualified `recruiter_id = recruiter_id` reads
  -- as column equals column in PL/pgSQL, which is true for every row, and
  -- would empty the table rather than this account's share of it.
  delete from public.jobs where public.jobs.recruiter_id = v_recruiter;

  insert into public.jobs
    (recruiter_id, company_id, title, location, description, requirements, package_min, package_max)
  values
  (v_recruiter, kriterion,
   'Intermediate Backend Developer',
   'Pretoria, Gauteng',
   'We are looking for a backend developer to work on the services behind our condition-monitoring platform. You will own features from the first commit through to production support, work with a small team that reviews each other''s code properly, and have a real say in how the system is built.

The platform processes sensor data from heavy machinery and turns it into something an engineer can act on. The backend is Java and Spring Boot against PostgreSQL, deployed in containers. We care more about how you reason about a problem than about the exact list of technologies you have used.',
   'At least 3 years building production backend services.
Java or a comparable language, and a real working knowledge of SQL.
Experience with containerised deployment.
Comfortable owning a service in production, including the parts nobody enjoys.
A relevant degree or diploma.',
   45000, 65000),

  (v_recruiter, kriterion,
   'Engineering Team Lead',
   'Pretoria, Gauteng',
   'You will lead a small platform team, own its delivery, and represent it to the executive. This is a hands-on lead role: you will still write code, but your first responsibility is the people and the plan.

The team is five engineers working on the services behind our monitoring platform. They are good and they are busy, and what they need is someone to clear the way, hold the line on quality, and make sure the right things get built.',
   'Team leadership
Budget management
Stakeholder management
Public speaking
Performance management
5+ years building production software, with at least 2 leading others
Java or a comparable language, and PostgreSQL
A relevant degree',
   85000, 110000),

  (v_recruiter, nedgroup,
   'Full-Stack Developer',
   'Sandton, Gauteng',
   'Join the team building the customer-facing side of our digital banking products. You will work across the stack: React on the front, Node and PostgreSQL behind it, with real users and real consequences on the other side of every release.

We release often and we test properly. You will be expected to write the tests, not to hand that to someone else, and to care about what the thing is like to use rather than only about whether it works.',
   '3+ years full-stack web development.
React and TypeScript.
Node.js, or another backend you can argue for.
PostgreSQL or a comparable relational database.
An eye for what makes an interface usable.',
   50000, 70000),

  (v_recruiter, nedgroup,
   'Site Reliability Engineer',
   'Sandton, Gauteng',
   'We need an infrastructure-minded engineer to design, build and monitor highly available infrastructure. You will build and maintain the deployment pipelines, write the internal tooling nobody else wants to write, and be the person who knows why the system is doing what it is doing at two in the morning.

This is a role for someone who finds the operational side genuinely interesting rather than something to be automated away and forgotten.',
   '2+ years in DevOps, SRE, or software engineering with an infrastructure focus.
Containerisation and orchestration.
CI/CD pipelines and infrastructure as code.
Monitoring, logging and alerting.
Clean automation code in Python or Bash.
A relevant degree.',
   60000, 85000),

  (v_recruiter, sandrift,
   'Data Engineer',
   'Cape Town, Western Cape',
   'Build and run the pipelines that move data from our clients'' systems into the warehouse our analysts work from. You will be responsible for the whole path: ingestion, transformation, scheduling, and the monitoring that tells us when a feed has gone quiet.

This is a greenfield-ish role on a platform that is already in production, which is the best of both: real users, and room to fix things properly.',
   'Strong Python.
Apache Airflow or a comparable orchestrator.
dbt, or a serious argument for something else.
Spark, BigQuery or Snowflake.
Dimensional modelling.
3+ years in a data engineering role specifically.',
   65000, 90000),

  (v_recruiter, thembi,
   'Mobile Developer (React Native)',
   'Durban, KwaZulu-Natal',
   'We are building the patient-facing app for a network of clinics across KwaZulu-Natal. It has to work on cheap handsets, on bad connections, in four languages. That constraint is the interesting part of the job.

You will own the mobile app end to end, working with one backend developer and a designer. The work matters: the people using it are booking appointments they would otherwise travel for hours to arrange in person.',
   'React Native, in production, on real devices.
Offline-first data handling.
Experience with low-bandwidth and low-end device constraints.
App Store and Play Store release experience.
3+ years mobile development.',
   50000, 72000);

  raise notice 'Seeded 4 companies and 6 jobs for %', recruiter_email;
end $$;
