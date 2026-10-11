'use client';

import { useActionState, type ReactNode } from 'react';
import { CheckCircle2, Loader2, TriangleAlert } from 'lucide-react';

import { saveProfile, type ProfileFormState } from '@/app/actions/profile';
import { Button } from '@/components/ui/button';
import type { CvHeader } from '@/lib/domain/types';

const initial: ProfileFormState = { status: 'idle', message: '' };

const field =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-[3px] disabled:opacity-50';

function Field({
  name,
  label,
  hint,
  children,
}: {
  name: string;
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? (
        <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * Edit what prints at the top of a tailored CV.
 *
 * `defaultValue` rather than controlled inputs. The form is uncontrolled on
 * purpose: there is nothing to compute as the person types, so holding each
 * field in React state would buy a re-render per keystroke and the chance of
 * the state and the DOM disagreeing.
 *
 * Every field except the name can be emptied, and emptying one removes it from
 * the document. That is why the action writes blanks through rather than
 * skipping them: a wrong line the parser invented has to be deletable.
 */
export function ProfileForm({ header }: { header: CvHeader | null }) {
  const [state, action, pending] = useActionState(saveProfile, initial);

  return (
    <form action={action} className="flex flex-col gap-5">
      <Field name="fullName" label="Full name">
        <input
          id="fullName"
          name="fullName"
          required
          maxLength={120}
          disabled={pending}
          defaultValue={header?.fullName ?? ''}
          autoComplete="name"
          className={field}
        />
      </Field>

      <Field
        name="headline"
        label="Headline"
        hint="One line under your name, like Backend Developer. Leave it empty and nothing is printed there."
      >
        <input
          id="headline"
          name="headline"
          maxLength={160}
          disabled={pending}
          defaultValue={header?.headline ?? ''}
          placeholder="Backend Developer"
          className={field}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="phone" label="Phone">
          <input
            id="phone"
            name="phone"
            type="tel"
            maxLength={40}
            disabled={pending}
            defaultValue={header?.phone ?? ''}
            placeholder="+27 82 555 0134"
            autoComplete="tel"
            className={field}
          />
        </Field>

        <Field name="location" label="Location">
          <input
            id="location"
            name="location"
            maxLength={120}
            disabled={pending}
            defaultValue={header?.location ?? ''}
            placeholder="Pretoria, Gauteng"
            className={field}
          />
        </Field>
      </div>

      <Field
        name="links"
        label="Links"
        hint="One per line. GitHub, LinkedIn, a portfolio. Eight at most, because a CV with more is a list of links."
      >
        <textarea
          id="links"
          name="links"
          rows={4}
          maxLength={2_000}
          disabled={pending}
          defaultValue={(header?.links ?? []).join('\n')}
          placeholder={'linkedin.com/in/your-name\ngithub.com/your-name'}
          className={field}
        />
      </Field>

      <div className="flex flex-col gap-3 border-t pt-5">
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Saving
            </>
          ) : (
            'Save'
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

        {state.status === 'saved' ? (
          <p
            role="status"
            className="border-accepted/40 bg-accepted-surface/40 animate-fade flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
          >
            <CheckCircle2 className="text-accepted mt-0.5 size-4 shrink-0" aria-hidden />
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
