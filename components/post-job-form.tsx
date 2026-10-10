'use client';

import { useActionState } from 'react';
import { Loader2, TriangleAlert } from 'lucide-react';

import { postJob, type JobFormState } from '@/app/actions/jobs';
import { Button } from '@/components/ui/button';

const initial: JobFormState = { status: 'idle', message: '' };

const field =
  'border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-[3px] disabled:opacity-50';

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium">
      {children}
    </label>
  );
}

export function PostJobForm() {
  const [state, action, pending] = useActionState(postJob, initial);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="company">Company</Label>
          <input id="company" name="company" required disabled={pending} className={field} />
          <p className="text-muted-foreground text-xs">
            If it is not on the system yet it will be created.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="location">Location</Label>
          <input
            id="location"
            name="location"
            required
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
          disabled={pending}
          placeholder="Intermediate Backend Developer"
          className={field}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">About the role</Label>
        <textarea
          id="description"
          name="description"
          required
          rows={8}
          disabled={pending}
          className={field}
        />
        {/*
          The bound is not arbitrary and it is worth telling the recruiter why.
          This text is what every applicant's CV gets compared against, so a
          one-line posting produces a tailoring with nothing to work from.
        */}
        <p className="text-muted-foreground text-xs leading-relaxed">
          At least 80 characters. This is what a candidate&apos;s CV gets
          compared against, so a thin description gives a thin result.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="requirements">What it asks for</Label>
        <textarea
          id="requirements"
          name="requirements"
          required
          rows={5}
          disabled={pending}
          placeholder={'5+ years in Java\nPostgreSQL\nContainerised deployment'}
          className={field}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="packageMin">Package from (optional)</Label>
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
          <Label htmlFor="packageMax">Package to (optional)</Label>
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
    </form>
  );
}
