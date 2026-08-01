import { notFound } from 'next/navigation';
import Link from 'next/link';

import { TailorForm } from '@/components/tailor-form';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireConsentedUser } from '@/lib/dal';
import { resumeRepository } from '@/lib/infrastructure/supabase-repo';

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
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          Back to your CVs
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Tailor to a job advert
        </h1>
        <p className="text-muted-foreground text-sm">
          Candid rewrites your existing experience in the advert&apos;s
          language. It will not add anything your CV does not support.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Paste the advert</CardTitle>
          <CardDescription>
            Your name and contact details are not sent. Only the experience,
            skills and education part of your CV goes to the model.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TailorForm resumeId={resume.id} />
        </CardContent>
      </Card>

      <Button variant="outline" asChild className="self-start">
        <Link href="/dashboard">Cancel</Link>
      </Button>
    </main>
  );
}
