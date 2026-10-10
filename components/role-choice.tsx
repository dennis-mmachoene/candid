'use client';

import { useActionState, useState } from 'react';
import { Briefcase, Loader2, Search, TriangleAlert } from 'lucide-react';

import { chooseRole, type JobFormState } from '@/app/actions/jobs';
import { Button } from '@/components/ui/button';

const initial: JobFormState = { status: 'idle', message: '' };

/**
 * Which side of the hire you are on.
 *
 * A single account is a candidate or a recruiter, not both. An account that
 * can post the job it applies to is a different product with a different set
 * of problems, and none of them are interesting here.
 *
 * The choice is presented as two cards rather than a dropdown because it is
 * the first thing a new person does and a dropdown hides one of the two
 * answers behind a click.
 *
 * It appears in two places. On `/onboarding` it is the question a new account
 * has to answer before it can do anything, and `current` is null. In settings
 * it is a switch, `current` is what the account is now, and the person is
 * changing their mind rather than answering for the first time. Same component,
 * because the second place existing is what makes the first one honest: a
 * question you can never revisit is a trap, not a choice.
 */

/**
 * Spelled out rather than imported from the job repository. This is a Client
 * Component and that module is infrastructure. The database enum is
 * `('candidate', 'recruiter')` and migration 0005 is the single source of it.
 */
type Role = 'candidate' | 'recruiter';

const OPTIONS: {
  value: Role;
  icon: typeof Search;
  title: string;
  body: string;
}[] = [
  {
    value: 'candidate',
    icon: Search,
    title: 'I am looking for work',
    body: 'Upload your CV, browse roles, and tailor your CV to the ones you want.',
  },
  {
    value: 'recruiter',
    icon: Briefcase,
    title: 'I am hiring',
    body: 'Post roles and see who applied, with the CV they chose to send.',
  },
];

export function RoleChoice({
  current = null,
  submitLabel = 'Continue',
}: {
  /** What the account is now, or null when it has never been asked. */
  current?: Role | null;
  submitLabel?: string;
}) {
  const [state, action, pending] = useActionState(chooseRole, initial);
  // An unanswered account starts on "looking for work" because that is what
  // most people signing up are. It is a starting position, not an answer.
  const [role, setRole] = useState<Role>(current ?? 'candidate');

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="role" value={role} />

      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = role === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setRole(option.value)}
              aria-pressed={selected}
              className={`flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors ${
                selected
                  ? 'border-brand-500/60 bg-brand-500/5'
                  : 'border-input hover:border-brand-500/30'
              }`}
            >
              <span className="border-brand-500/30 bg-brand-500/10 grid size-9 place-items-center rounded-lg border">
                <Icon className="text-brand-700 dark:text-brand-300 size-4" aria-hidden />
              </span>
              <span className="font-medium">{option.title}</span>
              <span className="text-muted-foreground text-sm leading-relaxed">
                {option.body}
              </span>
            </button>
          );
        })}
      </div>

      <Button
        type="submit"
        disabled={pending || role === current}
        className="self-start"
      >
        {pending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Setting up
          </>
        ) : (
          submitLabel
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
