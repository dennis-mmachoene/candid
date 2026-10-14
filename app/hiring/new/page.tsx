import Link from 'next/link';
import { ArrowLeft, Eye, ScanSearch, Users } from 'lucide-react';

import { PostJobForm } from '@/components/post-job-form';
import { Container } from '@/components/ui/container';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireSide } from '@/lib/guards';
import { jobRepository } from '@/lib/infrastructure/job-repo';

export const metadata = { title: 'Post a role' };

/**
 * What happens once a role is posted, in the order it happens.
 *
 * It sits beside the form rather than after it. A recruiter filling this in
 * for the first time is being asked for a long description and a requirements
 * list without being told what either is for, and "the requirements are what
 * each CV gets checked against" changes how carefully the field gets written.
 */
const afterwards = [
  {
    icon: Eye,
    title: 'It appears on the board',
    body: 'Every job seeker on Candid can see it and open it. There is no draft state, so post it when it is ready.',
  },
  {
    icon: ScanSearch,
    title: 'Applicants are checked against it',
    body: 'Someone who tailors their CV to this role has every claim traced back to their own CV. Anything your advert asks for that they cannot support is refused rather than written in.',
  },
  {
    icon: Users,
    title: 'You read what they sent',
    body: 'Applications arrive on this role, with the exact document each person submitted and nothing rewritten afterwards.',
  },
];

export default async function NewJobPage() {
  await requireSide('recruiter');

  // Offered as suggestions on the company field. RLS scopes this to what the
  // caller is allowed to see, so there is no filter here.
  const companies = await jobRepository.listCompanies();

  return (
    <main className="py-10 sm:py-14">
      <Container width="wide">
        <Link
          href="/hiring"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Your roles
        </Link>

        <header className="animate-rise mt-4 flex flex-col gap-2">
          <h1 className="text-fluid-2xl font-semibold tracking-tight">
            Post a role
          </h1>
          <p className="text-muted-foreground max-w-2xl text-pretty">
            Write it the way you would send it to a candidate. The description
            and the requirements are what every applicant gets measured
            against, so they are worth the few extra minutes.
          </p>
        </header>

        {/*
          Two columns from `lg`, form first in the source order.

          The explanation column is help, not content, so on a phone it falls
          below the thing it explains rather than standing between the heading
          and the first field.
        */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <Card>
            <CardHeader>
              <CardTitle asChild className="text-fluid-lg">
                <h2>The role</h2>
              </CardTitle>
              <CardDescription>
                Everything except the package is required.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PostJobForm companies={companies} />
            </CardContent>
          </Card>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
            <Card>
              <CardHeader>
                <CardTitle asChild className="text-base">
                  <h2>What happens next</h2>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="flex flex-col gap-5">
                  {afterwards.map((step, index) => (
                    <li key={step.title} className="flex gap-3">
                      <span className="border-brand-500/25 bg-brand-500/10 mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border">
                        <step.icon
                          className="text-brand-700 dark:text-brand-300 size-4"
                          aria-hidden
                        />
                      </span>
                      <div className="flex min-w-0 flex-col gap-1">
                        <h3 className="text-sm font-medium">
                          <span className="text-muted-foreground mr-1.5 tabular-nums">
                            {index + 1}.
                          </span>
                          {step.title}
                        </h3>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          {step.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            {companies.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle asChild className="text-base">
                    <h2>Companies on the system</h2>
                  </CardTitle>
                  <CardDescription>
                    Start typing in the company field to pick one.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-wrap gap-2">
                    {companies.map((company) => (
                      <li
                        key={company.id}
                        className="bg-muted rounded-md border px-2.5 py-1 text-xs"
                      >
                        {company.name}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
          </aside>
        </div>
      </Container>
    </main>
  );
}
