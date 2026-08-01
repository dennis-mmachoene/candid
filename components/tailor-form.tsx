'use client';

import { useActionState } from 'react';
import { Loader2, TriangleAlert } from 'lucide-react';

import { tailorResume, type TailorState } from '@/app/actions/tailor';
import { Button } from '@/components/ui/button';

const initialState: TailorState = { status: 'idle', message: '' };

export function TailorForm({ resumeId }: { resumeId: string }) {
  const [state, formAction, pending] = useActionState(
    tailorResume,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="resumeId" value={resumeId} />

      <div className="flex flex-col gap-2">
        <label htmlFor="title" className="text-sm font-medium">
          Job title <span className="text-muted-foreground">(optional)</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          maxLength={200}
          disabled={pending}
          placeholder="Senior Backend Engineer"
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] disabled:opacity-50"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="advert" className="text-sm font-medium">
          The job advert
        </label>
        <textarea
          id="advert"
          name="advert"
          required
          rows={12}
          minLength={80}
          maxLength={15_000}
          disabled={pending}
          placeholder="Paste the whole advert here, including the requirements list."
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] disabled:opacity-50"
        />
        <p className="text-muted-foreground text-xs">
          Paste the full advert. The requirements list is what Candid compares
          your CV against, so leaving it out gives a worse result.
        </p>
      </div>

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Tailoring
          </>
        ) : (
          'Tailor my CV'
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
    </form>
  );
}
