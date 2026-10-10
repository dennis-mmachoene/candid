import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { PostJobForm } from '@/components/post-job-form';
import { Container } from '@/components/ui/container';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireUser } from '@/lib/dal';

export const metadata = { title: 'Post a role' };

export default async function NewJobPage() {
  await requireUser();

  return (
    <main className="py-10 sm:py-14">
      <Container width="prose">
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
          <p className="text-muted-foreground">
            It appears on the board as soon as you post it.
          </p>
        </header>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle asChild className="text-fluid-lg">
              <h2>The role</h2>
            </CardTitle>
            <CardDescription>
              Write the description the way you would send it to a candidate.
              It is read by people and by the tailoring engine, and both do
              better with the real thing than with bullet fragments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PostJobForm />
          </CardContent>
        </Card>
      </Container>
    </main>
  );
}
