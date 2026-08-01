import { Badge } from '@/components/ui/badge';
import { POLICY_VERSION } from '@/lib/domain/consent';

export const metadata = { title: 'Terms' };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-3">
        <Badge variant="brand">Version {POLICY_VERSION}</Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Terms of use
        </h1>
        <p className="text-muted-foreground text-pretty">
          Short, and written to be read.
        </p>
      </header>

      <div className="mt-10 flex flex-col gap-10">
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            What Candid does
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Candid rewrites the wording of experience you already have so that
            it matches the language of a job advert, and tells you what the
            advert asks for that your CV does not support. It is a wording tool.
            It does not apply for jobs on your behalf and does not contact
            employers.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            What Candid will not do
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            It will not add a skill, employer, qualification or date that your
            uploaded CV does not support, even if you ask it to and even if the
            advert requires it. Claims that cannot be traced back to your CV are
            blocked and cannot be included in a downloaded file.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Your responsibility
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The CV you upload is the source of truth, and Candid cannot verify
            it. If your original CV contains something inaccurate, the tailored
            version will carry it forward. Read what you download before you
            send it, and be ready to answer questions on everything in it,
            including anything you approved from the &quot;your call&quot;
            section.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            No guarantee of outcome
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Candid formats your CV so that applicant tracking systems can read
            it, and rewords your experience to match the advert. It cannot
            promise an interview or a job. Hiring decisions are made by
            employers on grounds Candid has no access to.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Acceptable use
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Upload only your own CV. Do not upload another person&apos;s
            personal information. Automated or bulk use is not permitted, and
            rate limits apply.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Ending your use
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            You can delete your account and everything in it at any time. The
            deletion is immediate and cannot be undone.
          </p>
        </section>
      </div>
    </main>
  );
}
