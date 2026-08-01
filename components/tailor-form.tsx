'use client';

import { useActionState } from 'react';
import { Loader2, TriangleAlert, Wand2 } from 'lucide-react';

import { tailorResume, type TailorState } from '@/app/actions/tailor';
import { Button } from '@/components/ui/button';

const initialState: TailorState = { status: 'idle', message: '' };

const fieldClass =
  'border-input hover:border-brand-500/40 focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm transition-colors outline-none focus-visible:ring-[3px] disabled:opacity-50';

export function TailorForm({ resumeId }: { resumeId: string }) {
  const [state, formAction, pending] = useActionState(
    tailorResume,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="resumeId" value={resumeId} />

      <div className="flex flex-col gap-2">
        <label htmlFor="title" className="text-sm font-medium">
          Job title{' '}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          id="title"
          name="title"
          type="text"
          maxLength={200}
          disabled={pending}
          placeholder="Senior Backend Engineer"
          className={fieldClass}
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
          rows={14}
          minLength={80}
          maxLength={15_000}
          disabled={pending}
          placeholder="Paste the whole advert here, including the requirements list."
          className={`${fieldClass} resize-y leading-relaxed`}
        />
      </div>

      <Button type="submit" disabled={pending} size="lg" className="self-start">
        {pending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Tailoring
          </>
        ) : (
          <>
            <Wand2 className="size-4" aria-hidden />
            Tailor my CV
          </>
        )}
      </Button>

      {state.status === 'error' ? (
        <p
          role="alert"
          className="border-blocked/40 bg-blocked-surface/40 animate-fade flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
        >
          <TriangleAlert className="text-blocked mt-0.5 size-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
