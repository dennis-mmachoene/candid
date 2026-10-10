'use client';

import { useActionState } from 'react';
import { Loader2, Send, TriangleAlert } from 'lucide-react';

import {
  submitTailoredApplication,
  type ApplyState,
} from '@/app/actions/apply';
import { Button } from '@/components/ui/button';

const initial: ApplyState = { status: 'idle', message: '' };

/**
 * The last step, and the only one that creates an application.
 *
 * Everything before this is reversible. The tailoring exists, the report
 * exists, the document can be downloaded, and none of it has been sent
 * anywhere. Pressing this is the first irreversible act, so it sits on its own
 * and says what it does rather than saying "Continue".
 *
 * `blocked` disables it. A tailoring in which nothing survived validation has
 * no honest version to send, and the action refuses it as well: the button
 * being disabled is a courtesy, not the control.
 */
export function SubmitApplication({
  jobId,
  jobTitle,
  tailoringId,
  blocked,
}: {
  jobId: string;
  jobTitle: string;
  tailoringId: string;
  blocked: boolean;
}) {
  const [state, action, pending] = useActionState(
    submitTailoredApplication,
    initial,
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="tailoringId" value={tailoringId} />

      <p className="text-sm leading-relaxed">
        {blocked
          ? 'Nothing here could be traced back to your own CV, so there is no honest version to send.'
          : 'Happy with it? This sends the version above to the recruiter.'}
      </p>

      <Button type="submit" disabled={pending || blocked} className="self-start">
        {pending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Sending
          </>
        ) : (
          <>
            <Send aria-hidden />
            Send this to {jobTitle}
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
