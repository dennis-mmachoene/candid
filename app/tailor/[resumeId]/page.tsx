import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, EyeOff, Target } from 'lucide-react';

import { TailorForm } from '@/components/tailor-form';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireConsentedUser } from '@/lib/dal';
import { resumeRepository } from '@/lib/infrastructure/supabase-repo';

export const metadata = { title: 'Tailor to a job advert' };

export default async function TailorPage({
  params,
}: {
  params: Promise<{ resumeId: string }>;
}) {
  const { resumeId } = await params;
  await requireConsentedUser();

  // RLS makes someone else's CV indistinguishable from one that does not
  // exist, which is the right answer: it leaks nothing about whether the id
  // is real.
  const resume = await resumeRepository.getResume(resumeId);
  if (!resume) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/dashboard"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to your CVs
      </Link>

      <header className="animate-rise mt-6 flex flex-col gap-2">
        <Badge variant="brand">
          <Target className="size-3" aria-hidden />
          Step 2 of 3
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Tailor to a job advert
        </h1>
        <p className="text-muted-foreground text-pretty">
          Candid rewrites your existing experience in the advert&apos;s
          language. It will not add anything your CV does not support.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-6">
        <Card className="border-brand-500/25 bg-brand-500/5">
          <CardContent className="flex items-start gap-3 pt-6">
            <span className="border-brand-500/25 bg-brand-500/10 grid size-9 shrink-0 place-items-center rounded-lg border">
              <EyeOff className="text-brand-600 dark:text-brand-300 size-4" aria-hidden />
            </span>
            <p className="text-sm leading-relaxed">
              Your name and contact details are not sent. Only the experience,
              skills and education part of your CV goes to the model, and it
              never sees who you are.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Paste the advert</CardTitle>
            <CardDescription>
              Include the requirements list. That is what your CV gets compared
              against, so leaving it out gives a worse result.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TailorForm resumeId={resume.id} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
