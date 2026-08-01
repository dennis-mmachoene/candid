-- Template preference, and nothing else.
--
-- Still no id_number column. There never will be one.

alter table public.profiles
  add column if not exists default_template text not null default 'modern';

comment on column public.profiles.default_template is
  'Which export template this user prefers. Typography and spacing only — a template cannot change what a document contains, so this is a cosmetic preference and is treated as one.';

-- A CHECK rather than an enum: template ids live in application code
-- (lib/domain/resume-document.ts) and adding one should not require a
-- migration. The constraint is here to stop arbitrary text, not to be the
-- source of truth.
alter table public.profiles
  drop constraint if exists profiles_default_template_check;

alter table public.profiles
  add constraint profiles_default_template_check
  check (default_template in ('classic', 'modern', 'compact'));
