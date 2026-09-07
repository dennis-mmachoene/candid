'use client';

import { useActionState, useState } from 'react';
import { Trash2 } from 'lucide-react';

import { deleteResume, type DeleteResumeState } from '@/app/actions/resumes';
import { Button } from '@/components/ui/button';

const INITIAL: DeleteResumeState = { status: 'idle', message: '' };

/**
 * Two clicks, no dialog.
 *
 * A modal for this would be heavier than the action deserves. Asking again in
 * place is enough to stop an accidental tap, and it does not take over the
 * screen for something the person can simply upload again.
 *
 * The button is quiet on purpose. Red is reserved for deleting an account and
 * for genuine errors — nothing about a page listing somebody's career should
 * be shouting at them.
 */
export function DeleteResumeButton({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(deleteResume, INITIAL);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(true)}
        aria-label={`Delete ${label}`}
        className="text-muted-foreground hover:text-foreground"
      >
        <Trash2 className="size-4" aria-hidden />
        Delete
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <span className="text-muted-foreground text-sm">Delete this CV?</span>
      <Button type="submit" size="sm" variant="destructive" disabled={pending}>
        {pending ? 'Deleting…' : 'Yes, delete'}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setConfirming(false)}
        disabled={pending}
      >
        Keep it
      </Button>
      {state.status === 'error' ? (
        <span role="alert" className="text-destructive text-sm">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
