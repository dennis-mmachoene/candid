import { redirect } from 'next/navigation';

import { acceptConsent } from '@/app/actions/consent';
import { signOut } from '@/app/actions/auth';
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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          Before you start
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
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
          className="border-blocked/40 bg-blocked/10 rounded-md border px-3 py-2 text-sm"
        >
          Your consent could not be recorded. Please try again.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>What Candid promises</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
            {CONSENT_STATEMENTS.map((statement) => (
              <li key={statement}>{statement}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Who processes your information</CardTitle>
          <CardDescription>
            These are the only third parties involved, and exactly what each one
            receives.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {OPERATORS.map((operator) => (
            <div key={operator.name} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{operator.name}</span>
                <span
                  className={
                    operator.receivesIdentifyingData
                      ? 'border-borderline/40 text-borderline rounded-full border px-2 py-0.5 text-xs'
                      : 'border-accepted/40 text-accepted rounded-full border px-2 py-0.5 text-xs'
                  }
                >
                  {operator.receivesIdentifyingData
                    ? 'receives identifying data'
                    : 'receives no identifying data'}
                </span>
              </div>
              <p className="text-muted-foreground text-sm">{operator.purpose}</p>
              <p className="text-muted-foreground text-xs">
                Processed in: {operator.jurisdiction}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <form action={acceptConsent}>
          <Button type="submit">I understand and agree</Button>
        </form>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            No thanks, sign me out
          </Button>
        </form>
      </div>

      <p className="text-muted-foreground text-xs">
        If this policy changes in a way that affects what is shared or with whom,
        the version above changes and you will be asked again. Old consent stops
        counting at that point.
      </p>
    </main>
  );
}
