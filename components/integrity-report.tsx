'use client';

import { useState, useTransition } from 'react';
import { Ban, Check, CircleAlert, Loader2 } from 'lucide-react';

import { approveClaims } from '@/app/actions/tailor';
import { Button } from '@/components/ui/button';
import type { ValidatedClaim } from '@/lib/domain/types';

/**
 * The integrity report.
 *
 * The design rule here: a user cannot fairly approve an inference without
 * seeing what it was inferred from, so every borderline claim shows the line of
 * their own CV it came from. Blocked claims are shown too, with the reason,
 * rather than silently dropped — being told what was refused and why is the
 * point of the product.
 *
 * The checkboxes only govern borderline claims. Blocked claims have no control
 * next to them because there is nothing to decide.
 */

interface Props {
  tailoringId: string;
  accepted: readonly ValidatedClaim[];
  borderline: readonly ValidatedClaim[];
  blocked: readonly ValidatedClaim[];
  initiallyApproved: readonly string[];
}

function Evidence({ claim }: { claim: ValidatedClaim }) {
  if (claim.evidence.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {claim.evidence.slice(0, 3).map((item, index) => (
        <li
          key={`${item.line}-${index}`}
          className="border-muted-foreground/30 text-muted-foreground border-l-2 pl-3 text-xs italic"
        >
          {item.line}
        </li>
      ))}
    </ul>
  );
}

export function IntegrityReport({
  tailoringId,
  accepted,
  borderline,
  blocked,
  initiallyApproved,
}: Props) {
  const [approved, setApproved] = useState<Set<string>>(
    new Set(initiallyApproved),
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (canonical: string) => {
    setSaved(false);
    setApproved((current) => {
      const next = new Set(current);
      if (next.has(canonical)) next.delete(canonical);
      else next.add(canonical);
      return next;
    });
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await approveClaims(tailoringId, [...approved]);
      if (result.ok) setSaved(true);
      else setError(result.message ?? 'Something went wrong.');
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-accepted flex items-center gap-2 text-lg font-medium">
          <Check className="size-4" aria-hidden />
          Traced to your CV ({accepted.length})
        </h2>
        <p className="text-muted-foreground text-sm">
          These appear in your original CV. They go in as they are.
        </p>
        {accepted.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {accepted.map((claim, index) => (
              <li
                key={`${claim.canonical}-${index}`}
                className="border-accepted/40 bg-accepted/10 rounded-full border px-3 py-1 text-sm"
              >
                {claim.claim.text}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-borderline flex items-center gap-2 text-lg font-medium">
          <CircleAlert className="size-4" aria-hidden />
          Your call ({borderline.length})
        </h2>
        <p className="text-muted-foreground text-sm">
          Each of these is a fair reading of something your CV says, but it is
          not stated outright. Read the evidence and decide. You will be asked
          about these in an interview.
        </p>

        {borderline.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nothing needed your judgement this time.
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {borderline.map((claim, index) => (
                <li
                  key={`${claim.canonical}-${index}`}
                  className="border-borderline/40 bg-borderline/5 rounded-md border p-4"
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={approved.has(claim.canonical)}
                      onChange={() => toggle(claim.canonical)}
                      className="mt-1 size-4 shrink-0"
                    />
                    <span className="flex flex-col gap-1">
                      <span className="font-medium">{claim.claim.text}</span>
                      <span className="text-muted-foreground text-sm">
                        {claim.reason}
                      </span>
                    </span>
                  </label>
                  <Evidence claim={claim} />
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={save} disabled={pending} className="self-start">
                {pending ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden />
                    Saving
                  </>
                ) : (
                  'Save my choices'
                )}
              </Button>
              {saved ? (
                <span role="status" className="text-accepted text-sm">
                  Saved.
                </span>
              ) : null}
              {error ? (
                <span role="alert" className="text-blocked text-sm">
                  {error}
                </span>
              ) : null}
            </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-blocked flex items-center gap-2 text-lg font-medium">
          <Ban className="size-4" aria-hidden />
          Refused ({blocked.length})
        </h2>
        <p className="text-muted-foreground text-sm">
          Candid would not add these. There is no way to approve them. If you do
          have this experience, put it in your CV and upload it again.
        </p>

        {blocked.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nothing was refused. The draft stayed inside what your CV supports.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {blocked.map((claim, index) => (
              <li
                key={`${claim.canonical}-${index}`}
                className="border-blocked/40 bg-blocked/5 rounded-md border p-3"
              >
                <p className="font-medium">{claim.claim.text}</p>
                <p className="text-muted-foreground text-sm">{claim.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
