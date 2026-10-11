import Link from 'next/link';
import { FileUp, Upload, User } from 'lucide-react';

import { ProfileForm } from '@/components/profile-form';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireUser } from '@/lib/dal';
import { resumeRepository } from '@/lib/infrastructure/supabase-repo';

export const metadata = { title: 'Your profile' };

export default async function ProfilePage() {
  const user = await requireUser();

  const [header, resumes] = await Promise.all([
    resumeRepository.getProfileHeader(),
    resumeRepository.listResumes(),
  ]);

  // Whether the stored profile would print anything at all. A brand-new
  // account has a row with every column null, which is a different situation
  // from one somebody has filled in and worth saying so.
  const filled = Boolean(
    header?.fullName ?? header?.phone ?? header?.location ?? header?.headline,
  );

  return (
    <main className="py-10 sm:py-14">
      <Container width="wide">
        <header className="animate-rise flex flex-col gap-2">
          <h1 className="text-fluid-2xl font-semibold tracking-tight">
            Your profile
          </h1>
          <p className="text-muted-foreground max-w-2xl text-pretty">
            This is what prints at the top of every CV Candid produces, and
            what an employer sees next to your application. Nothing here is
            sent to the model: it is your own contact details, and the tailoring
            never touches them.
          </p>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <span className="bg-muted grid size-9 place-items-center rounded-lg border">
                  <User className="size-4" aria-hidden />
                </span>
                <CardTitle asChild className="text-fluid-lg">
                  <h2>Your details</h2>
                </CardTitle>
              </div>
              <CardDescription>
                Only the name is required. Clearing any other field removes it
                from the document.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm header={header} />
            </CardContent>
          </Card>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
            {/*
              The printed header, as stored.

              Deliberately rendered from the saved values rather than from what
              is being typed. A preview that followed the keystrokes would be
              showing a document that does not exist yet, and the question this
              card answers is "what would print if I exported right now".
            */}
            <Card>
              <CardHeader>
                <CardTitle asChild className="text-base">
                  <h2>What prints</h2>
                </CardTitle>
                <CardDescription>
                  The top of your CV, as saved. Export to see the rest.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filled ? (
                  <div className="bg-card rounded-lg border p-4">
                    <p className="text-base font-semibold">
                      {header?.fullName ?? 'No name saved'}
                    </p>
                    {header?.headline ? (
                      <p className="text-muted-foreground text-sm">
                        {header.headline}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                      {[user.email, header?.phone, header?.location]
                        .filter(Boolean)
                        .join('  ·  ')}
                    </p>
                    {header?.links && header.links.length > 0 ? (
                      <ul className="text-muted-foreground mt-1.5 flex flex-col gap-0.5 text-xs">
                        {header.links.map((link) => (
                          <li key={link} className="break-anywhere">
                            {link}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Nothing saved yet, so a tailored CV would print without a
                    name on it. Fill in the form, or upload a CV and Candid
                    reads it from the top of the page.
                  </p>
                )}
              </CardContent>
            </Card>

            {/*
              The second path, named as a path rather than hidden on another
              screen. Most people will never type any of this: they upload a CV
              once and the parser fills it in. The form exists for when the
              parser gets something wrong, and this card is how somebody who
              arrived here first finds the easier route.
            */}
            <Card>
              <CardHeader>
                <span className="border-brand-500/25 bg-brand-500/10 mb-1 grid size-9 place-items-center rounded-lg border">
                  <FileUp className="text-brand-700 dark:text-brand-300 size-4" aria-hidden />
                </span>
                <CardTitle asChild className="text-base">
                  <h2>Or let your CV fill it in</h2>
                </CardTitle>
                <CardDescription>
                  {resumes.length === 0
                    ? 'Upload a CV and Candid reads the name, contact details and links off the top of it.'
                    : 'Uploading another CV fills in anything still empty here, and leaves what you have typed alone.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="secondary" className="w-full">
                  <Link href="/dashboard">
                    <Upload className="size-4" aria-hidden />
                    {resumes.length === 0 ? 'Upload your CV' : 'Go to your CVs'}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </Container>
    </main>
  );
}
