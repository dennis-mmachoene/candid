'use client';

import { useState, useTransition } from 'react';
import { Ban, Check, CircleAlert, Loader2, Quote } from 'lucide-react';

import { approveClaims } from '@/app/actions/tailor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
    <ul className="mt-3 flex flex-col gap-2">
      {claim.evidence.slice(0, 3).map((item, index) => (
        <li
          key={`${item.line}-${index}`}
          className="bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-lg px-3 py-2 text-xs leading-relaxed"
        >
          <Quote className="mt-0.5 size-3 shrink-0 opacity-60" aria-hidden />
          <span className="italic">{item.line}</span>
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
    <div className="flex flex-col gap-6">
      {/* --- Accepted --------------------------------------------------- */}
      <Card className="border-accepted/25">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <span className="border-accepted/30 bg-accepted/10 grid size-9 place-items-center rounded-lg border">
              <Check className="text-accepted size-4" aria-hidden />
            </span>
            <CardTitle className="text-lg">
              Traced to your CV
              <span className="text-muted-foreground ml-2 font-normal tabular-nums">
                {accepted.length}
              </span>
            </CardTitle>
          </div>
          <CardDescription>
            These appear in your original CV. They go in as they are.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accepted.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {accepted.map((claim, index) => (
                <li key={`${claim.canonical}-${index}`}>
                  <Badge variant="accepted">{claim.claim.text}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* --- Borderline ------------------------------------------------- */}
      <Card className="border-borderline/25">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <span className="border-borderline/30 bg-borderline/10 grid size-9 place-items-center rounded-lg border">
              <CircleAlert className="text-borderline size-4" aria-hidden />
            </span>
            <CardTitle className="text-lg">
              Your call
              <span className="text-muted-foreground ml-2 font-normal tabular-nums">
                {borderline.length}
              </span>
            </CardTitle>
          </div>
          <CardDescription>
            Each of these is a fair reading of something your CV says, but it is
            not stated outright. Read the evidence and decide. You will be asked
            about these in an interview.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {borderline.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing needed your judgement this time.
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {borderline.map((claim, index) => {
                  const checked = approved.has(claim.canonical);
                  return (
                    <li
                      key={`${claim.canonical}-${index}`}
                      className={`rounded-xl border p-4 transition-colors ${
                        checked
                          ? 'border-borderline/45 bg-borderline-surface/40'
                          : 'border-border bg-transparent'
                      }`}
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(claim.canonical)}
                          className="accent-borderline mt-1 size-4 shrink-0 cursor-pointer"
                        />
                        <span className="flex flex-col gap-1">
                          <span className="font-medium">
                            {claim.claim.text}
                          </span>
                          <span className="text-muted-foreground text-sm leading-relaxed">
                            {claim.reason}
                          </span>
                        </span>
                      </label>
                      <Evidence claim={claim} />
                    </li>
                  );
                })}
              </ul>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={save} disabled={pending}>
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
                  <span
                    role="status"
                    className="text-accepted animate-fade flex items-center gap-1.5 text-sm"
                  >
                    <Check className="size-4" aria-hidden />
                    Saved
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
        </CardContent>
      </Card>

      {/* --- Blocked ---------------------------------------------------- */}
      <Card className="border-blocked/25">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <span className="border-blocked/30 bg-blocked/10 grid size-9 place-items-center rounded-lg border">
              <Ban className="text-blocked size-4" aria-hidden />
            </span>
            <CardTitle className="text-lg">
              Refused
              <span className="text-muted-foreground ml-2 font-normal tabular-nums">
                {blocked.length}
              </span>
            </CardTitle>
          </div>
          <CardDescription>
            Candid would not add these, and there is no way to approve them. If
            you do have this experience, put it in your CV and upload it again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {blocked.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing was refused. The draft stayed inside what your CV
              supports.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {blocked.map((claim, index) => (
                <li
                  key={`${claim.canonical}-${index}`}
                  className="border-blocked/25 bg-blocked-surface/25 rounded-xl border p-4"
                >
                  <p className="font-medium">{claim.claim.text}</p>
                  <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
                    {claim.reason}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
