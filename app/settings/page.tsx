import { FileText, ShieldCheck, TriangleAlert, User } from 'lucide-react';

import {
  DeleteAccountForm,
  TemplatePreferenceForm,
} from '@/components/settings-forms';
import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/ui/container';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getConsentStatus, requireConsentedUser } from '@/lib/dal';
import { OPERATORS, POLICY_VERSION } from '@/lib/domain/consent';
import { createClient } from '@/lib/infrastructure/supabase/server';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await requireConsentedUser();
  const { version } = await getConsentStatus();

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('default_template')
    .maybeSingle();

  return (
    <main className="py-10 sm:py-14">
      <Container width="prose">
      <header className="animate-rise flex flex-col gap-2">
        <Badge variant="brand">Settings</Badge>
        <h1 className="text-fluid-2xl font-semibold tracking-tight">
          {user.firstName}&apos;s settings
        </h1>
        <p className="text-muted-foreground">
          Your account, your preferences, and the button that removes all of it.
        </p>
      </header>

      <div className="mt-10 flex flex-col gap-6">
        {/* --- Account --------------------------------------------------- */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <span className="bg-muted grid size-9 place-items-center rounded-lg border">
                <User className="size-4" aria-hidden />
              </span>
              <CardTitle asChild className="text-fluid-lg">
                <h2>Account</h2>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
              <span className="text-muted-foreground">Signed in as</span>
              <span className="break-anywhere font-medium">{user.email}</span>
            </div>
            {user.fullName ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted-foreground">Name from Google</span>
                <span className="font-medium">{user.fullName}</span>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Sign-in method</span>
              <span className="font-medium">Google, no password stored</span>
            </div>
            <p className="text-muted-foreground border-t pt-4 text-xs leading-relaxed">
              This name comes from your Google account and is read fresh each
              time you load a page. Candid does not store a second copy of it,
              and it is not the name taken from your CV — that one stays
              encrypted until a document is built.
            </p>
          </CardContent>
        </Card>

        {/* --- Template -------------------------------------------------- */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <span className="bg-muted grid size-9 place-items-center rounded-lg border">
                <FileText className="size-4" aria-hidden />
              </span>
              <CardTitle asChild className="text-fluid-lg">
                <h2>Default template</h2>
              </CardTitle>
            </div>
            <CardDescription>
              Which look to pre-select when you download. Templates change
              typography and spacing only, never what the document contains.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TemplatePreferenceForm
              current={profile?.default_template ?? 'modern'}
            />
          </CardContent>
        </Card>

        {/* --- Consent --------------------------------------------------- */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <span className="border-accepted/30 bg-accepted/10 grid size-9 place-items-center rounded-lg border">
                <ShieldCheck className="text-accepted size-4" aria-hidden />
              </span>
              <CardTitle asChild className="text-fluid-lg">
                <h2>Your consent</h2>
              </CardTitle>
            </div>
            <CardDescription>
              You accepted policy version{' '}
              <span className="font-mono text-xs">
                {version ?? POLICY_VERSION}
              </span>
              . If this changes, you will be asked again.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {OPERATORS.map((operator) => (
              <div
                key={operator.name}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="font-medium">{operator.name}</span>
                <Badge
                  variant={
                    operator.receivesIdentifyingData ? 'borderline' : 'accepted'
                  }
                >
                  {operator.receivesIdentifyingData
                    ? 'receives identifying data'
                    : 'receives no identifying data'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* --- Erasure --------------------------------------------------- */}
        <Card className="border-blocked/30">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <span className="border-blocked/30 bg-blocked/10 grid size-9 place-items-center rounded-lg border">
                <TriangleAlert className="text-blocked size-4" aria-hidden />
              </span>
              <CardTitle asChild className="text-fluid-lg">
                <h2>Delete everything</h2>
              </CardTitle>
            </div>
            <CardDescription>
              Your right under section 24 of POPIA, and a button rather than a
              support request.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="text-muted-foreground flex flex-col gap-2 text-sm leading-relaxed">
              <p>This removes, immediately and permanently:</p>
              <ul className="list-disc pl-5">
                <li>Every CV you have uploaded, and its de-identified text</li>
                <li>Your encrypted name, email and phone number</li>
                <li>Every tailored version and every job advert you pasted</li>
                <li>Your consent record and your account itself</li>
              </ul>
              <p>
                There is nothing to erase at the AI provider. It never received
                anything identifying about you.
              </p>
              <p className="text-foreground font-medium">
                This cannot be undone. Download anything you want to keep first.
              </p>
            </div>
            <DeleteAccountForm />
          </CardContent>
        </Card>
      </div>
    </Container>
    </main>
  );
}
