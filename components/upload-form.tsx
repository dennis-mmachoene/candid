'use client';

import { useActionState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';

import { uploadCv, type UploadState } from '@/app/actions/upload';
import { Button } from '@/components/ui/button';

const initialState: UploadState = { status: 'idle', message: '' };

/**
 * The upload form.
 *
 * `accept` on the input is a convenience for the file picker and nothing more.
 * The server decides the format from magic bytes and ignores both the extension
 * and the MIME type the browser reports, because a client can claim anything.
 */
export function UploadForm() {
  const [state, formAction, pending] = useActionState(uploadCv, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="cv" className="text-sm font-medium">
          Your current CV
        </label>
        <input
          id="cv"
          name="cv"
          type="file"
          accept=".pdf,.docx"
          required
          disabled={pending}
          className="border-input file:bg-secondary file:text-secondary-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none file:mr-3 file:rounded file:border-0 file:px-3 file:py-1 file:text-sm focus-visible:ring-[3px] disabled:opacity-50"
        />
        <p className="text-muted-foreground text-xs">
          PDF or Word (.docx), up to 5 MB. A scan or photo will not work — the
          text has to be selectable.
        </p>
      </div>

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Processing
          </>
        ) : (
          'Upload and de-identify'
        )}
      </Button>

      {state.status === 'error' ? (
        <p
          role="alert"
          className="border-blocked/40 bg-blocked/10 flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      ) : null}

      {state.status === 'success' ? (
        <div
          role="status"
          className="border-accepted/40 bg-accepted/10 flex flex-col gap-2 rounded-md border px-3 py-3 text-sm"
        >
          <p className="flex items-start gap-2 font-medium">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            {state.message}
          </p>
          <p className="text-muted-foreground flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            Your name, email address and phone number were removed and encrypted
            separately. {state.skillCount} skill
            {state.skillCount === 1 ? '' : 's'} were recorded from your CV as
            the list every future claim gets checked against.
          </p>
        </div>
      ) : null}
    </form>
  );
}
