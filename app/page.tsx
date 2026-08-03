import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  AlignLeft,
  ArrowRight,
  Ban,
  Check,
  CircleAlert,
  ClipboardPaste,
  EyeOff,
  FileCheck2,
  FileDown,
  Info,
  Lock,
  ScanSearch,
  ShieldCheck,
  Upload,
} from 'lucide-react';

import { signInWithGoogle } from '@/app/actions/auth';
import { GoogleIcon } from '@/components/google-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Container } from '@/components/ui/container';
import { getVerifiedUser } from '@/lib/dal';
import { CONSENT_STATEMENTS, OPERATORS } from '@/lib/domain/consent';

const steps = [
  {
    icon: Upload,
    title: 'Upload your CV',
    body: 'PDF or Word. Your name, email, phone and ID number are stripped out before anything else happens.',
  },
  {
    icon: ClipboardPaste,
    title: 'Paste the advert',
    body: 'The whole thing, requirements list included. That list is what your CV gets compared against.',
  },
  {
    icon: ScanSearch,
    title: 'See what was kept, and what was refused',
    body: 'Every claim is traced back to your CV. Anything that cannot be traced is blocked, and you are told why.',
  },
  {
    icon: FileDown,
    title: 'Download it',
    body: 'PDF or Word, formatted so an applicant tracking system can actually read it back.',
  },
];

const promises = [
  {
    icon: EyeOff,
    title: 'Your identity never reaches the AI',
    body: 'Your name, email address and phone number are removed before anything is sent, and reattached afterwards on our server. If your CV carries a South African ID number it is redacted and thrown away.',
    footnote: 'There is no id_number column in the database. Not an empty one. None.',
  },
  {
    icon: FileCheck2,
    title: 'Nothing gets invented',
    body: 'Every skill, employer and date in the tailored version is checked against your original. Untraceable claims are blocked outright. Fair inferences are shown to you with the evidence, and only go in if you say so.',
    footnote: 'A blocked claim cannot reach a file, whatever you click.',
  },
  {
    icon: AlignLeft,
    title: 'Built to get past the filter',
    body: 'Single column. Real selectable text. Conventional headings. No tables, no text boxes, no images. The format applicant tracking systems can parse rather than the one that looks nice and scores zero.',
    footnote: 'Tested by reading every export back through a parser.',
  },
];

const refusals = [
  {
    title: 'Add a skill you do not have',
    body: 'Even when the advert asks for it. It goes in your gaps list instead, with somewhere to go and learn it.',
  },
  {
    title: 'Invent an employer or stretch a date',
    body: 'This is what gets an offer withdrawn after a background check. Both are checked against your original CV.',
  },
  {
    title: 'Send your name to an AI provider',
    body: 'Not your name, not your email, not your phone number, not your ID number. The model sees experience and nothing else.',
  },
  {
    title: 'Keep your data when you leave',
    body: 'One button deletes everything you own, and the deletion is immediate.',
  },
];

/**
 * A small, honest illustration of the one screen that carries the product: the
 * integrity report. These rows are a generic example, not a real user and not a
 * statistic — the whole thesis is that Candid never fabricates, so the landing
 * page does not either.
 */
const sampleVerdicts = [
  {
    icon: Check,
    label: 'Python',
    note: 'Traced to your CV',
    variant: 'accepted' as const,
  },
  {
    icon: CircleAlert,
    label: 'Team leadership',
    note: 'A fair reading — your call',
    variant: 'borderline' as const,
  },
  {
    icon: Ban,
    label: 'Kubernetes',
    note: 'Not in your CV — refused',
    variant: 'blocked' as const,
  },
];

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ signin?: string; error?: string }>;
}) {
  // Next 15 makes searchParams async. Awaiting it is required, not optional.
  const params = await searchParams;
  const user = await getVerifiedUser();

  if (user) redirect('/dashboard');

  const notice =
    params.error === 'auth'
      ? 'Sign-in did not complete. Please try again.'
      : params.signin === 'required'
        ? 'Please sign in to continue.'
        : null;

  return (
    <main>
      {/* ---------------------------------------------------------------- */}
      {/* Hero — typography and space, no gradient, no glass                */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-b">
        <Container className="py-14 sm:py-20 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="animate-rise flex max-w-2xl flex-col items-start gap-6">
              <Badge variant="brand">
                <Lock className="size-3" aria-hidden />
                Built for South African job seekers
              </Badge>

              <h1 className="text-fluid-3xl font-semibold tracking-tight text-balance">
                An{' '}
                <span className="text-brand-700 dark:text-brand-300">
                  honest
                </span>{' '}
                CV, tailored to the job.
              </h1>

              <p className="text-fluid-base text-muted-foreground max-w-xl leading-relaxed text-pretty">
                Applicant tracking systems reject good candidates for bad
                wording. Candid rewrites what you have actually done in the
                language the advert uses, and tells you plainly what you are
                missing.
              </p>

              {notice ? (
                <p
                  role="status"
                  className="border-border bg-muted text-foreground rounded-lg border px-4 py-2.5 text-sm"
                >
                  {notice}
                </p>
              ) : null}

              <div className="flex w-full flex-col gap-3 pt-1 sm:w-auto sm:flex-row sm:items-center">
                <form action={signInWithGoogle} className="w-full sm:w-auto">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full sm:w-auto"
                  >
                    <GoogleIcon className="size-5" />
                    Sign in with Google
                  </Button>
                </form>
                <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                  <Link href="#how">
                    See how it works
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              </div>

              <p className="text-muted-foreground text-sm">
                No password is created or stored. Google confirms who you are and
                returns only your email address.
              </p>
            </div>

            {/* An honest illustration of the integrity report — the screen the
                whole product is built around. */}
            <div className="animate-rise lg:justify-self-end">
              <div className="bg-card w-full max-w-md rounded-lg border p-5 shadow-soft sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="border-brand-500/25 bg-brand-500/10 grid size-8 place-items-center rounded-md border">
                      <ShieldCheck
                        className="text-brand-700 dark:text-brand-300 size-4"
                        aria-hidden
                      />
                    </span>
                    <span className="text-sm font-semibold">
                      Integrity check
                    </span>
                  </div>
                  <Badge variant="outline" className="text-muted-foreground">
                    example
                  </Badge>
                </div>

                <ul className="mt-5 flex flex-col gap-2.5">
                  {sampleVerdicts.map((row) => (
                    <li
                      key={row.label}
                      className="border-border flex items-center gap-3 rounded-md border px-3 py-2.5"
                    >
                      <span
                        className={
                          row.variant === 'accepted'
                            ? 'border-accepted/30 bg-accepted/10 text-accepted grid size-7 shrink-0 place-items-center rounded-md border'
                            : row.variant === 'borderline'
                              ? 'border-borderline/30 bg-borderline/10 text-borderline grid size-7 shrink-0 place-items-center rounded-md border'
                              : 'border-blocked/30 bg-blocked/10 text-blocked grid size-7 shrink-0 place-items-center rounded-md border'
                        }
                      >
                        <row.icon className="size-4" aria-hidden />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="text-sm font-medium">{row.label}</span>
                        <span className="text-muted-foreground text-xs">
                          {row.note}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="text-muted-foreground mt-5 border-t pt-4 text-xs leading-relaxed">
                  Every claim is traced to your original CV. Refused claims can
                  never reach the downloaded file.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* How it works                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section id="how" className="bg-muted/30 scroll-mt-20 border-b py-16 sm:py-20">
        <Container>
          <div className="flex max-w-2xl flex-col gap-3">
            <Badge variant="brand">How it works</Badge>
            <h2 className="text-fluid-2xl font-semibold tracking-tight text-balance">
              Four steps, and you can see what happened at every one.
            </h2>
            <p className="text-muted-foreground text-fluid-base text-pretty">
              Nothing runs invisibly. You are shown what was kept, what was
              refused, and what evidence each decision rested on.
            </p>
          </div>

          <ol className="mt-10 grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
            {steps.map((step, index) => (
              <li key={step.title}>
                <Card className="h-full">
                  <CardHeader>
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="border-brand-500/25 bg-brand-500/10 grid size-10 shrink-0 place-items-center rounded-md border">
                        <step.icon
                          className="text-brand-700 dark:text-brand-300 size-5"
                          aria-hidden
                        />
                      </span>
                      <span className="text-muted-foreground/50 font-display text-2xl font-semibold tabular-nums">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <CardTitle className="text-base">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-muted-foreground text-sm leading-relaxed">
                    {step.body}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Promises                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section id="promises" className="scroll-mt-20 py-16 sm:py-20">
        <Container>
          <div className="flex max-w-2xl flex-col gap-3">
            <Badge variant="brand">Our promises</Badge>
            <h2 className="text-fluid-2xl font-semibold tracking-tight text-balance">
              Two guarantees, enforced in code rather than in marketing.
            </h2>
            <p className="text-muted-foreground text-fluid-base text-pretty">
              Both are covered by tests that fail the build if they ever stop
              being true.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:gap-5 lg:grid-cols-3">
            {promises.map((promise) => (
              <Card key={promise.title} className="h-full">
                <CardHeader>
                  <span className="border-brand-500/25 bg-brand-500/10 mb-2 grid size-11 place-items-center rounded-md border">
                    <promise.icon
                      className="text-brand-700 dark:text-brand-300 size-5"
                      aria-hidden
                    />
                  </span>
                  <CardTitle className="text-fluid-lg">
                    {promise.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {promise.body}
                  </p>
                  <p className="border-brand-500/40 text-foreground/80 break-anywhere border-l-2 pl-3 text-xs leading-relaxed">
                    {promise.footnote}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Refusals                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section id="refusals" className="bg-muted/30 scroll-mt-20 border-y py-16 sm:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-start">
            <div className="flex flex-col gap-4">
              <Badge variant="blocked">
                <Ban className="size-3" aria-hidden />
                What Candid will not do
              </Badge>
              <h2 className="text-fluid-2xl font-semibold tracking-tight text-balance">
                Most CV tools sell you the opposite of this.
              </h2>
              <p className="text-muted-foreground text-fluid-base text-pretty">
                Padding a CV works right up until someone asks a question about
                it. Candid is built so that everything on the page is something
                you can defend in the room.
              </p>
              <div className="pt-2">
                <Button asChild variant="outline">
                  <Link href="#how">
                    See what it does instead
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              </div>
            </div>

            <ul className="flex flex-col gap-3">
              {refusals.map((refusal) => (
                <li
                  key={refusal.title}
                  className="bg-card flex items-start gap-4 rounded-lg border p-4 sm:p-5"
                >
                  <span className="border-blocked/30 bg-blocked/10 mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border">
                    <Ban className="text-blocked size-4" aria-hidden />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="font-medium">{refusal.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {refusal.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Data handling                                                     */}
      {/* ---------------------------------------------------------------- */}
      <section className="py-16 sm:py-20">
        <Container>
          <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-10">
            <div className="flex flex-col gap-4">
              <Badge variant="brand">
                <ShieldCheck className="size-3" aria-hidden />
                Your data
              </Badge>
              <h2 className="text-fluid-2xl font-semibold tracking-tight text-balance">
                You will be told exactly who touches your information.
              </h2>
              <p className="text-muted-foreground text-pretty leading-relaxed">
                POPIA requires it, and a privacy claim you cannot check is not
                worth much. This is the same list you will see before you can
                use the app.
              </p>
              <ul className="mt-2 flex flex-col gap-3">
                {CONSENT_STATEMENTS.map((statement) => (
                  <li key={statement} className="flex items-start gap-3">
                    <span className="border-accepted/30 bg-accepted/10 mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border">
                      <Info className="text-accepted size-3" aria-hidden />
                    </span>
                    <span className="text-muted-foreground text-sm leading-relaxed">
                      {statement}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-fluid-lg">
                  Who processes your information
                </CardTitle>
                <CardDescription>
                  Four companies, and what each one actually receives.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {OPERATORS.map((operator) => (
                  <div key={operator.name} className="flex flex-col gap-1.5">
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
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </Container>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Closing call to action — a calm bordered panel, no gradient/glow  */}
      {/* ---------------------------------------------------------------- */}
      <section className="pb-16 sm:pb-20">
        <Container>
          <div className="border-brand-500/25 bg-brand-500/5 relative overflow-hidden rounded-lg border px-5 py-12 text-center sm:px-12 sm:py-16">
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-5">
              <h2 className="text-fluid-2xl font-semibold tracking-tight text-balance">
                Start with the CV you already have.
              </h2>
              <p className="text-fluid-base text-muted-foreground text-pretty">
                No payment, no password, and nothing on the finished CV that you
                cannot back up.
              </p>
              <form action={signInWithGoogle} className="w-full pt-1 sm:w-auto">
                <Button type="submit" size="lg" className="w-full sm:w-auto">
                  <GoogleIcon className="size-5" />
                  Sign in with Google
                </Button>
              </form>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
