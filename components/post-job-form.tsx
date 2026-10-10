'use client';

import { useActionState, useState, type ReactNode } from 'react';
import { CheckCircle2, Loader2, TriangleAlert } from 'lucide-react';

import { postJob, type JobFormState } from '@/app/actions/jobs';
import { Button } from '@/components/ui/button';

const initial: JobFormState = { status: 'idle', message: '' };

/**
 * The lower bound the server enforces on a description.
 *
 * Repeated here rather than imported because `app/actions/jobs.ts` is a
 * server module and this is a Client Component. The duplication is the point
 * of the comment: if the schema changes, this number has to change with it,
 * and a counter that lies is worse than no counter.
 */
const DESCRIPTION_MINIMUM = 80;

const field =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-[3px] disabled:opacity-50';

function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium">
      {children}
    </label>
  );
}

/**
 * A titled group of fields.
 *
 * The form was one flat column of nine inputs, which is the shape that makes
 * people give up halfway. Three named groups say how much is left.
 */
function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 border-t pt-5 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-1">
        <legend className="text-sm font-semibold">{title}</legend>
        {hint ? (
          <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>
        ) : null}
      </div>
      {children}
    </fieldset>
  );
}

export function PostJobForm({
  companies,
}: {
  /** Names already on the system, offered as suggestions. */
  companies: readonly { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(postJob, initial);

  // Held on the client only to drive the two counters below. The form still
  // posts the fields themselves, so nothing here is load-bearing.
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');

  const described = description.trim().length;
  const longEnough = described >= DESCRIPTION_MINIMUM;

  // Each non-empty line becomes something an applicant's CV is checked
  // against, so the count is the honest measure of this field rather than its
  // character length.
  const requirementLines = requirements
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0).length;

  return (
    <form action={action} className="flex flex-col gap-6">
      <Group
        title="Where and what"
        hint="This is what shows on the board before anyone opens the role."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="company">Company</Label>
            <input
              id="company"
              name="company"
              required
              maxLength={120}
              disabled={pending}
              list="known-companies"
              autoComplete="organization"
              className={field}
            />
            {/*
              A datalist rather than a select.

              A select would force every role onto a company that already
              exists, and the first role posted by anyone would have nowhere to
              go. This suggests what is there and still accepts a new name. The
              server matches case-insensitively, so "kriterion" and "Kriterion"
              are already the same company; the suggestions are here to stop
              "Kriterion" and "Kriterion Ltd" becoming two.
            */}
            <datalist id="known-companies">
              {companies.map((company) => (
                <option key={company.id} value={company.name} />
              ))}
            </datalist>
            <p className="text-muted-foreground text-xs">
              {companies.length > 0
                ? 'Pick one of yours, or type a new name and it will be created.'
                : 'Type the name and it will be created.'}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="location">Location</Label>
            <input
              id="location"
              name="location"
              required
              maxLength={120}
              disabled={pending}
              placeholder="Pretoria, Gauteng"
              className={field}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="title">Job title</Label>
          <input
            id="title"
            name="title"
            required
            maxLength={120}
            disabled={pending}
            placeholder="Intermediate Backend Developer"
            className={field}
          />
        </div>
      </Group>

      <Group
        title="The description"
        hint="Read by people, and by the tailoring engine. Both do better with the real thing than with bullet fragments."
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="description">About the role</Label>
          <textarea
            id="description"
            name="description"
            required
            rows={8}
            minLength={DESCRIPTION_MINIMUM}
            maxLength={15_000}
            disabled={pending}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What the team does, what this person will own, and what the work is actually like."
            className={field}
          />
          {/*
            The bound is not arbitrary and it is worth showing live rather than
            explaining once.

            This text is what every applicant's CV gets compared against, so a
            one-line posting produces a tailoring with nothing to work from.
            The server refuses anything under the minimum, and finding that out
            by pressing Post and reading an error is the worst way to learn it.
          */}
          <p
            className={`text-xs leading-relaxed ${
              longEnough ? 'text-accepted' : 'text-muted-foreground'
            }`}
            aria-live="polite"
          >
            {longEnough ? (
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5" aria-hidden />
                Long enough to tailor against. {described} characters.
              </span>
            ) : (
              `${DESCRIPTION_MINIMUM - described} more character${
                DESCRIPTION_MINIMUM - described === 1 ? '' : 's'
              } needed. A thin description gives a thin result.`
            )}
          </p>
        </div>
      </Group>

      <Group
        title="What it asks for"
        hint="One per line. Each line is checked against the applicant's CV, and anything their CV cannot support is refused rather than written in."
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="requirements">Requirements</Label>
          <textarea
            id="requirements"
            name="requirements"
            required
            rows={6}
            maxLength={5_000}
            disabled={pending}
            value={requirements}
            onChange={(event) => setRequirements(event.target.value)}
            placeholder={'5+ years in Java\nPostgreSQL\nContainerised deployment\nA relevant degree or diploma'}
            className={field}
          />
          <p className="text-muted-foreground text-xs" aria-live="polite">
            {requirementLines === 0
              ? 'Nothing listed yet.'
              : `${requirementLines} requirement${requirementLines === 1 ? '' : 's'}.`}
          </p>
        </div>
      </Group>

      <Group
        title="The package"
        hint="Optional, and worth filling in. A posting with no range gets fewer applications."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="packageMin">From, per month</Label>
            <input
              id="packageMin"
              name="packageMin"
              type="number"
              min={0}
              step={1000}
              disabled={pending}
              placeholder="45000"
              className={field}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="packageMax">To, per month</Label>
            <input
              id="packageMax"
              name="packageMax"
              type="number"
              min={0}
              step={1000}
              disabled={pending}
              placeholder="60000"
              className={field}
            />
          </div>
        </div>
      </Group>

      <div className="flex flex-col gap-3 border-t pt-5">
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Posting
            </>
          ) : (
            'Post this role'
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
      </div>
    </form>
  );
}
