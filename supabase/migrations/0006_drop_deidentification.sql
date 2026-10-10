-- Candid — remove the de-identification layer.
--
-- Candid began as a CV tailoring tool with two guarantees: it never invents
-- experience, and it never shows the model who you are. The second one is
-- being removed.
--
-- Why. The product is now a job application platform used with test CVs for a
-- coursework build and a presentation. It is not handed to real applicants, so
-- there is no real identity to protect, and the machinery that protected it
-- was the single biggest source of confusion in the interface: an upload
-- button that said "de-identify", a consent gate before anything could be
-- done, and a preview that hid the user's own name from them.
--
-- What stays. The anti-fabrication guarantee, which is the part that makes
-- this more than a wrapper around a model. Every claim is still checked
-- against the applicant's own CV, and a claim that cannot be traced is still
-- blocked and still cannot reach an exported file.
--
-- The CV header is now read from `profiles` instead of being split off, held
-- encrypted, and reattached at export. 0005 added the columns for it.
--
-- One rule from 0001 is unchanged and always will be:
--
--   THERE IS NO id_number COLUMN IN THIS SCHEMA, AND THERE MUST NEVER BE ONE.
--
-- Not storing an identity number was never about de-identification. It is
-- about not collecting what the purpose does not require, and the purpose
-- still does not require it.

-- ---------------------------------------------------------------------------
-- resumes
-- ---------------------------------------------------------------------------
--
-- `content` now holds the CV as uploaded. It is no longer the de-identified
-- half of a split, so the two columns that supported the split go with it.

alter table public.resumes
  drop column if exists identity_header_enc,
  drop column if exists redacted_id_count;

comment on column public.resumes.content is
  'The text of the uploaded CV. This is the applicant''s master CV: the single record every tailored version is checked against.';

comment on table public.resumes is
  'An uploaded CV. The original file is still not kept, only its extracted text, because nothing in the system reads the file again.';

-- ---------------------------------------------------------------------------
-- consent_records
-- ---------------------------------------------------------------------------
--
-- The consent gate is gone from the interface. The table is left in place
-- rather than dropped: it holds records of consent that people really gave
-- during testing, and deleting evidence that someone agreed to something is
-- not an improvement on keeping it.
--
-- Nothing writes to it any more.

comment on table public.consent_records is
  'Historic. The consent gate was removed when the POPIA layer was dropped. Kept because a record of what someone agreed to should not be deleted just because the feature was.';
