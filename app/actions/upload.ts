'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/lib/dal';
import { readHeader } from '@/lib/domain/cv-header';
import { buildInventory } from '@/lib/domain/inventory';
import {
  MAX_UPLOAD_BYTES,
  UnsupportedFileError,
  cvParser,
} from '@/lib/infrastructure/parser';
import { DatabaseError, resumeRepository } from '@/lib/infrastructure/supabase-repo';
import { createClient } from '@/lib/infrastructure/supabase/server';

/**
 * Upload, parse, persist, and fill in the profile.
 *
 * This is where an applicant's master CV comes from. Everything else in the
 * product reads it: the skill inventory is built from it, every tailored
 * version is checked against it, and the exported document is assembled from
 * what survives that check.
 *
 *   1. Verify the session. Nothing runs for a signed-out caller.
 *   2. Validate the upload as a shape, then as bytes. `file.type` is never
 *      consulted; the parser decides the format from magic bytes, so a
 *      renamed file cannot select the wrong parser.
 *   3. Store the extracted text and build the inventory from it.
 *   4. Read the header and fill in any profile field that is still empty, so
 *      that uploading a CV once is enough to have a profile.
 *
 * The uploaded file itself is not stored, only its text. Nothing in the system
 * reads the file again, so keeping it would be keeping a copy of somebody's
 * document for no purpose.
 */

export interface UploadState {
  status: 'idle' | 'success' | 'error';
  message: string;
  resumeId?: string;
  skillCount?: number;
  /** True when the upload filled in profile fields that were empty. */
  profileUpdated?: boolean;
}

const uploadSchema = z.object({
  file: z
    .instanceof(File, { message: 'Please choose a CV to upload.' })
    .refine((file) => file.size > 0, 'That file is empty.')
    .refine(
      (file) => file.size <= MAX_UPLOAD_BYTES,
      `Please upload a file smaller than ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
    ),
});

export async function uploadCv(
  _previous: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const user = await requireUser();

  const parsedInput = uploadSchema.safeParse({ file: formData.get('cv') });
  if (!parsedInput.success) {
    return {
      status: 'error',
      message: parsedInput.error.issues[0]?.message ?? 'That upload was not valid.',
    };
  }

  const file = parsedInput.data.file;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());

    // Magic-byte validation happens inside the parser, before any parsing
    // library touches the bytes.
    const parsed = await cvParser.parse(bytes);

    const content = parsed.text;
    const inventory = buildInventory(content);

    const resume = await resumeRepository.saveResume({
      content,
      format: parsed.format,
      originalFilename: file.name,
    });

    await resumeRepository.saveInventory(resume.id, inventory);

    // Uploading a CV is the only onboarding step most people will do, so the
    // profile fills itself in from it. Only empty fields are written, so a
    // thinner second CV cannot blank out something typed by hand.
    const header = readHeader(content);
    await resumeRepository.saveProfileHeader(header);

    const supabase = await createClient();
    await supabase.rpc('log_audit_event', {
      p_action: 'resume.uploaded',
      p_metadata: {
        resume_id: resume.id,
        format: parsed.format,
        skill_count: inventory.canonical.size,
      },
    });

    revalidatePath('/dashboard');

    return {
      status: 'success',
      message: header.fullName
        ? `CV saved. This is now your profile, ${header.fullName.split(/\s+/)[0]}.`
        : 'CV saved. This is now your profile.',
      resumeId: resume.id,
      skillCount: inventory.canonical.size,
      profileUpdated: Boolean(header.fullName ?? header.email ?? header.phone),
    };
  } catch (error) {
    // Two error types are safe to show verbatim because their messages were
    // written to be read by users. Everything else is logged and generalised —
    // a stack trace or a Postgres constraint name tells an attacker about our
    // internals and tells the user nothing useful.
    if (error instanceof UnsupportedFileError || error instanceof DatabaseError) {
      return { status: 'error', message: error.message };
    }

    console.error('[upload] unexpected failure', { userId: user.id, error });
    return {
      status: 'error',
      message: 'Something went wrong processing that CV. Please try again.',
    };
  }
}
