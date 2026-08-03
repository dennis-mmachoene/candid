'use client';

import { useActionState } from 'react';
import { Check, Loader2, TriangleAlert } from 'lucide-react';

import {
  deleteAccount,
  saveDefaultTemplate,
  type DeleteState,
  type SettingsState,
} from '@/app/actions/settings';
import { Button } from '@/components/ui/button';
import { TEMPLATES } from '@/lib/domain/resume-document';

const settingsInitial: SettingsState = { status: 'idle', message: '' };
const deleteInitial: DeleteState = { status: 'idle', message: '' };

export function TemplatePreferenceForm({ current }: { current: string }) {
  const [state, formAction, pending] = useActionState(
    saveDefaultTemplate,
    settingsInitial,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {TEMPLATES.map((template) => (
          <label
            key={template.id}
            className="card-hover has-[:checked]:border-brand-500/50 has-[:checked]:bg-brand-500/5 flex cursor-pointer flex-col gap-1.5 rounded-lg border p-4 transition-colors"
          >
            <input
              type="radio"
              name="template"
              value={template.id}
              defaultChecked={template.id === current}
              className="sr-only"
            />
            <span className="font-medium">{template.name}</span>
            <span className="text-muted-foreground text-xs leading-relaxed">
              {template.description}
            </span>
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} size="sm">
          {pending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Saving
            </>
          ) : (
            'Save preference'
          )}
        </Button>
        {state.status === 'saved' ? (
          <span role="status" className="text-accepted animate-fade flex items-center gap-1.5 text-sm">
            <Check className="size-4" aria-hidden />
            {state.message}
          </span>
        ) : null}
        {state.status === 'error' ? (
          <span role="alert" className="text-blocked text-sm">
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}

/**
 * Account deletion.
 *
 * Typing DELETE is friction, not security. It exists so that nobody removes
 * their entire history with a mis-click. The actual protection is server-side:
 * the session is re-verified against the Auth server before anything is
 * removed.
 */
export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState(
    deleteAccount,
    deleteInitial,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="confirmation" className="text-sm font-medium">
          Type <span className="font-mono">DELETE</span> to confirm
        </label>
        <input
          id="confirmation"
          name="confirmation"
          type="text"
          autoComplete="off"
          required
          disabled={pending}
          placeholder="DELETE"
          className="border-blocked/40 focus-visible:ring-blocked/30 max-w-xs rounded-lg border bg-transparent px-3 py-2.5 font-mono text-sm outline-none focus-visible:ring-[3px] disabled:opacity-50"
        />
      </div>

      <Button
        type="submit"
        variant="destructive"
        disabled={pending}
        className="self-start"
      >
        {pending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Deleting
          </>
        ) : (
          'Delete my account and everything in it'
        )}
      </Button>

      {state.status === 'error' ? (
        <p
          role="alert"
          className="border-blocked/40 bg-blocked-surface/40 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
        >
          <TriangleAlert className="text-blocked mt-0.5 size-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
