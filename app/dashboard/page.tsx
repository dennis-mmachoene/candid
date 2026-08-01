import { FileText, ShieldCheck } from 'lucide-react';

import { signOut } from '@/app/actions/auth';
import { UploadForm } from '@/components/upload-form';
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

export default async function DashboardPage() {
  // The gate. A signed-out user is redirected, and a signed-in user who has
  // not accepted the current policy version goes to /consent. Both checks
  // happen here, next to the data, not in middleware.
  const user = await requireConsentedUser();

  // No user id passed and none needed: Row-Level Security scopes this to the
  // caller's own rows.
  const resumes = await resumeRepository.listResumes();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
            Candid
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Your CVs
          </h1>
          <p className="text-muted-foreground text-sm">
            Signed in as {user.email}
          </p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Upload a CV</CardTitle>
          <CardDescription>
            It is de-identified the moment it arrives. Only the experience,
            skills and education part is stored.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UploadForm />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Stored CVs</h2>

        {resumes.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Nothing yet. Upload a CV above to get started.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {resumes.map((resume) => (
              <li key={resume.id}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="size-4" aria-hidden />
                      {resume.format.toUpperCase()} CV
                    </CardTitle>
                    <CardDescription>
                      Uploaded{' '}
                      {resume.createdAt.toLocaleDateString('en-ZA', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <p className="text-muted-foreground flex items-start gap-2 text-xs">
                      <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      Stored de-identified. Contact details are encrypted
                      separately and never left this server.
                    </p>
                    <pre className="bg-muted text-muted-foreground max-h-32 overflow-hidden rounded-md p-3 text-xs whitespace-pre-wrap">
                      {resume.content.slice(0, 400)}
                      {resume.content.length > 400 ? '…' : ''}
                    </pre>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-muted-foreground text-xs">
        Tailoring against a job advert arrives in the next phase.
      </p>
    </main>
  );
}
