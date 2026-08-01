import { FileCheck2, ShieldCheck, Sparkles } from 'lucide-react';
import { redirect } from 'next/navigation';

import { signInWithGoogle } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getVerifiedUser } from '@/lib/dal';
import { CONSENT_STATEMENTS } from '@/lib/domain/consent';

const promises = [
  {
    icon: ShieldCheck,
    title: 'Your identity never reaches the AI',
    body: 'Your name, email address and phone number are stripped out before anything is sent, and added back afterwards on our server. A South African ID number is redacted and discarded — there is nowhere in the database to store one.',
  },
  {
    icon: FileCheck2,
    title: 'Nothing gets invented',
    body: 'Every skill in your tailored CV is checked against your original. Anything that cannot be traced back is blocked outright, and anything that is a fair inference is shown to you with the evidence before it goes in.',
  },
  {
    icon: Sparkles,
    title: 'Built to get through the filter',
    body: 'Exports are single-column, real selectable text, conventional headings, no tables or images — the format applicant tracking systems can actually read.',
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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-12 px-6 py-16">
      <header className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          Candid
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          An honest CV, tailored to the job.
        </h1>
        <p className="text-muted-foreground max-w-xl text-lg text-pretty">
          Applicant tracking systems reject good candidates for bad wording.
          Candid rewrites what you have actually done in the language the advert
          uses — and tells you plainly what you are missing.
        </p>

        {notice ? (
          <p
            role="status"
            className="border-borderline/40 bg-borderline/10 text-foreground rounded-md border px-3 py-2 text-sm"
          >
            {notice}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <form action={signInWithGoogle}>
            <Button type="submit">Sign in with Google</Button>
          </form>
          <Button variant="outline" asChild>
            <a href="#promises">What Candid will not do</a>
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          No password is created or stored. Google confirms who you are and
          returns only your email address.
        </p>
      </header>

      <section id="promises" className="flex flex-col gap-4">
        {promises.map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon className="size-4" aria-hidden />
                {title}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              {body}
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>What you will be asked to agree to</CardTitle>
            <CardDescription>
              Taken directly from the consent notice, so there are no surprises
              later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-muted-foreground flex list-disc flex-col gap-2 pl-5 text-sm">
              {CONSENT_STATEMENTS.map((statement) => (
                <li key={statement}>{statement}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
