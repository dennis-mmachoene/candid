'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireConsentedUser } from '@/lib/dal';
import { deidentify } from '@/lib/domain/identity';
import { buildInventory } from '@/lib/domain/inventory';
import {
  MAX_UPLOAD_BYTES,
  UnsupportedFileError,
  cvParser,
} from '@/lib/infrastructure/parser';
import { DatabaseError, resumeRepository } from '@/lib/infrastructure/supabase-repo';
import { createClient } from '@/lib/infrastructure/supabase/server';

/**
 * Upload → parse → de-identify → persist.
 *
 * The ordering here is the whole security story, so it is worth naming:
 *
 *   1. Verify the session and consent. Nothing runs for a signed-out caller.
 *   2. Validate the upload as a shape, then as bytes. `file.type` is never
 *      consulted; the parser decides the format from magic bytes.
 *   3. De-identify. The plaintext CV exists in memory for exactly as long as
 *      this function runs, and the only thing written to the database is the
 *      de-identified content plus the encrypted header.
 *   4. Persist under RLS.
 *
 * The original file is deliberately never stored. It contains the unredacted ID
 * number and full contact details, and keeping a copy would quietly undo the
 * redaction we just performed. This departs from the build spec, which lists
 * Supabase Storage in the stack — it is a departure that strengthens the
 * guarantee rather than weakening it, and it is flagged in the Phase 2 audit
 * notes rather than made silently.
 */

export interface UploadState {
  status: 'idle' | 'success' | 'error';
  message: string;
  resumeId?: string;
  redactedIdCount?: number;
  skillCount?: number;
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
  const user = await requireConsentedUser();

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

    // Nothing downstream of this line sees the identifying version.
    const { identity, content, redactedIdCount } = deidentify(parsed.text);
    const inventory = buildInventory(content);

    const resume = await resumeRepository.saveResume({
      content,
      format: parsed.format,
      identity,
      originalFilename: file.name,
      redactedIdCount,
    });

    await resumeRepository.saveInventory(resume.id, inventory);

    const supabase = await createClient();
    await supabase.rpc('log_audit_event', {
      p_action: 'resume.uploaded',
      p_metadata: {
        resume_id: resume.id,
        format: parsed.format,
        redacted_id_count: redactedIdCount,
      },
    });

    revalidatePath('/dashboard');

    return {
      status: 'success',
      message:
        redactedIdCount > 0
          ? `CV processed. ${redactedIdCount} ID number${redactedIdCount === 1 ? ' was' : 's were'} redacted and discarded.`
          : 'CV processed.',
      resumeId: resume.id,
      redactedIdCount,
      skillCount: inventory.canonical.size,
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
