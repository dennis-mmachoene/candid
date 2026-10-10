'use client';

import { useActionState } from 'react';
import { FileText, Loader2, Sparkles, TriangleAlert } from 'lucide-react';

import { applyWithProfile, tailorForJob, type ApplyState } from '@/app/actions/apply';
import { Button } from '@/components/ui/button';

const initial: ApplyState = { status: 'idle', message: '' };

/**
 * The choice the product is built around.
 *
 * Two buttons, side by side, with what each one does written underneath it
 * rather than hidden behind a tooltip. The applicant is deciding whether a
 * model touches their CV, and that is not a decision to make from an icon.
 *
 * Neither button is styled as the obvious one. Sending your CV as it stands is
 * a perfectly good answer, and a layout that greys it out next to a glowing
 * "Tailor with AI" is telling the applicant what to think.
 */
export function ApplyPanel({
  jobId,
  hasCv,
}: {
  jobId: string;
  hasCv: boolean;
}) {
  const [profileState, applyAction, applyPending] = useActionState(
    applyWithProfile,
    initial,
  );
  const [tailorState, tailorAction, tailorPending] = useActionState(
    tailorForJob,
    initial,
  );

  const busy = applyPending || tailorPending;
  const error =
    profileState.status === 'error'
      ? profileState.message
      : tailorState.status === 'error'
        ? tailorState.message
        : null;

  if (!hasCv) {
    return (
      <div className="border-borderline/40 bg-borderline-surface/40 rounded-lg border px-4 py-3 text-sm">
        <p className="font-medium">Upload a CV first.</p>
        <p className="text-muted-foreground mt-1">
          It becomes your profile, and it is what every tailored version gets
          checked against.
        </p>
        <Button asChild size="sm" className="mt-3">
          <a href="/dashboard">Upload a CV</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <form action={applyAction} className="flex flex-col gap-2">
          <input type="hidden" name="jobId" value={jobId} />
          <Button
            type="submit"
            variant="secondary"
            disabled={busy}
            className="w-full"
          >
            {applyPending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Sending
              </>
            ) : (
              <>
                <FileText aria-hidden />
                Apply with my CV
              </>
            )}
          </Button>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Your CV goes as it is. Nothing is rewritten, and no model sees it.
          </p>
        </form>

        <form action={tailorAction} className="flex flex-col gap-2">
          <input type="hidden" name="jobId" value={jobId} />
          <Button type="submit" disabled={busy} className="w-full">
            {tailorPending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Tailoring
              </>
            ) : (
              <>
                <Sparkles aria-hidden />
                Tailor it for this role
              </>
            )}
          </Button>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Your experience, rewritten in this advert&apos;s language. You read
            what was kept and what was refused before anything is sent.
          </p>
        </form>
      </div>

      {tailorPending ? (
        <p className="text-muted-foreground text-sm" role="status">
          Reading your CV against this advert. This takes about fifteen seconds.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="border-blocked/40 bg-blocked-surface/40 animate-fade flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
        >
          <TriangleAlert className="text-blocked mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}
