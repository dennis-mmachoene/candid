'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';

import { setApplicationStatus, type JobFormState } from '@/app/actions/jobs';
import type { ApplicationStatus } from '@/lib/infrastructure/job-repo';

const initial: JobFormState = { status: 'idle', message: '' };

const OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: 'submitted', label: 'Sent' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'rejected', label: 'Not taken forward' },
  { value: 'hired', label: 'Hired' },
];

/**
 * Change where an application sits.
 *
 * A select that submits on change, with no save button. The alternative is a
 * row of five buttons per applicant, which on a list of twenty is a wall.
 *
 * The recruiter can set any status including back to "Sent", because a
 * one-way flow is wrong here: people get shortlisted by mistake and the
 * interface should not make that permanent.
 */
export function ApplicantStatus({
  applicationId,
  jobId,
  current,
}: {
  applicationId: string;
  jobId: string;
  current: ApplicationStatus;
}) {
  const [, action, pending] = useActionState(setApplicationStatus, initial);

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="jobId" value={jobId} />
      <label htmlFor={`status-${applicationId}`} className="sr-only">
        Application status
      </label>
      <select
        id={`status-${applicationId}`}
        name="status"
        defaultValue={current}
        disabled={pending}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 rounded-lg border bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:ring-[3px] disabled:opacity-50"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {pending ? (
        <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden />
      ) : null}
    </form>
  );
}
