-- Let the Original template be stored as a preference.
--
-- Still no id_number column. There never will be one.
--
-- 0002 wrote this constraint with a comment saying template ids live in
-- application code and that adding one should not require a migration. That
-- was half true. Adding a template to TEMPLATES does not require a migration
-- to *render* with it, which is what the comment meant. Storing it as somebody's
-- preference does, because the constraint is here in the database.
--
-- A fourth template, 'original', was added to lib/domain/resume-document.ts
-- without this. The result: choosing it in Settings and saving raised a
-- constraint violation, while exporting with it worked. Worth writing down,
-- because it is the shape of mistake the comment in 0002 invites.

alter table public.profiles
  drop constraint if exists profiles_default_template_check;

alter table public.profiles
  add constraint profiles_default_template_check
  check (default_template in ('classic', 'modern', 'compact', 'original'));

comment on constraint profiles_default_template_check on public.profiles is
  'Mirrors the ids in TEMPLATES (lib/domain/resume-document.ts). Adding a template there means adding it here. The constraint exists to stop arbitrary text, not to be the source of truth.';
