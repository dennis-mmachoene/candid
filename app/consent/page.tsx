import { redirect } from 'next/navigation';
import { Check, ShieldCheck, TriangleAlert } from 'lucide-react';

import { acceptConsent } from '@/app/actions/consent';
import { signOut } from '@/app/actions/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getConsentStatus, requireUser } from '@/lib/dal';
import {
  CONSENT_STATEMENTS,
  OPERATORS,
  POLICY_VERSION,
} from '@/lib/domain/consent';

export const metadata = { title: 'Before you start' };

/**
 * The POPIA consent gate.
 *
 * This blocks the dashboard, and it names every operator rather than pointing
 * at a policy page nobody opens. Section 18 of the Act requires the data
 * subject be told who processes their information and for what; a link is not
 * that.
 *
 * The row for Anthropic is the one that carries weight. Candid's entire claim
 * is that the AI provider never receives anything identifying, and this is
 * where that claim is made in writing to the person it concerns.
 */
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  await requireUser();

  const { consented } = await getConsentStatus();
  if (consented) redirect('/dashboard');

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="animate-rise flex flex-col gap-3">
        <Badge variant="brand">
          <ShieldCheck className="size-3" aria-hidden />
          Before you start
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          How Candid handles your information
        </h1>
        <p className="text-muted-foreground text-pretty">
          Read this properly. It is short on purpose. Policy version{' '}
          <span className="font-mono text-xs">{POLICY_VERSION}</span>.
        </p>
      </header>

      {params.error ? (
        <p
          role="alert"
          className="border-blocked/40 bg-blocked-surface/50 mt-6 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm"
        >
          <TriangleAlert className="text-blocked mt-0.5 size-4 shrink-0" aria-hidden />
          Your consent could not be recorded. Please try again.
        </p>
      ) : null}

      <div className="mt-10 flex flex-col gap-6">
        <Card className="border-accepted/25 bg-accepted-surface/25">
          <CardHeader>
            <CardTitle className="text-lg">What Candid promises</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {CONSENT_STATEMENTS.map((statement) => (
                <li key={statement} className="flex items-start gap-3">
                  <span className="border-accepted/30 bg-accepted/10 mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border">
                    <Check className="text-accepted size-3" aria-hidden />
                  </span>
                  <span className="text-sm leading-relaxed">{statement}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Who processes your information
            </CardTitle>
            <CardDescription>
              These are the only third parties involved, and exactly what each
              one receives.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {OPERATORS.map((operator) => (
              <div
                key={operator.name}
                className="border-border/60 flex flex-col gap-1.5 border-b pb-5 last:border-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{operator.name}</span>
                  <Badge
                    variant={
                      operator.receivesIdentifyingData
                        ? 'borderline'
                        : 'accepted'
                    }
                  >
                    {operator.receivesIdentifyingData
                      ? 'receives identifying data'
                      : 'receives no identifying data'}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {operator.purpose}
                </p>
                <p className="text-muted-foreground/80 text-xs">
                  Processed in: {operator.jurisdiction}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <form action={acceptConsent}>
            <Button type="submit" size="lg" className="w-full sm:w-auto">
              <Check className="size-4" aria-hidden />
              I understand and agree
            </Button>
          </form>
          <form action={signOut}>
            <Button
              type="submit"
              size="lg"
              variant="outline"
              className="w-full sm:w-auto"
            >
              No thanks, sign me out
            </Button>
          </form>
        </div>

        <p className="text-muted-foreground text-xs leading-relaxed">
          If this policy changes in a way that affects what is shared or with
          whom, the version above changes and you will be asked again. Old
          consent stops counting at that point.
        </p>
      </div>
    </main>
  );
}
