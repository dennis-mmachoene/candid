import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/ui/container';
import { POLICY_VERSION } from '@/lib/domain/consent';

export const metadata = { title: 'Terms' };

export default function TermsPage() {
  return (
    <main className="py-12 sm:py-16">
      <Container width="prose">
      <header className="flex flex-col gap-3">
        <Badge variant="brand">Version {POLICY_VERSION}</Badge>
        <h1 className="text-fluid-2xl font-semibold tracking-tight">
          Terms of use
        </h1>
        <p className="text-muted-foreground text-pretty">
          Short, and written to be read.
        </p>
      </header>

      <div className="mt-10 flex flex-col gap-10">
        <section className="flex flex-col gap-3">
          <h2 className="text-fluid-xl font-semibold tracking-tight">
            What Candid does
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Candid is a job board with a CV tool attached to it. Employers post
            roles. You keep one CV, rewrite its wording to match a role you are
            answering, and send that version to the employer. Candid also tells
            you what the advert asks for that your CV does not support.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Candid does not apply for jobs on your behalf. Every application is
            one you read and sent yourself.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-fluid-xl font-semibold tracking-tight">
            What Candid will not do
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            It will not add a skill, employer, qualification or date that your
            uploaded CV does not support, even if you ask it to and even if the
            advert requires it. Claims that cannot be traced back to your CV are
            blocked, and a blocked claim cannot reach a downloaded file or an
            employer.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-fluid-xl font-semibold tracking-tight">
            Your responsibility
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The CV you upload is the source of truth, and Candid cannot verify
            it. If your original CV contains something inaccurate, the tailored
            version will carry it forward. Read what you send before you send
            it, and be ready to answer questions on everything in it, including
            anything you approved from the &quot;your call&quot; section.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-fluid-xl font-semibold tracking-tight">
            If you are hiring
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            A role you post is visible to every signed-in job seeker, so post
            only roles you are actually hiring for and describe them honestly. A
            CV sent to you is for assessing that application and nothing else:
            do not forward it, publish it, or use it for another role without
            asking the applicant first.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-fluid-xl font-semibold tracking-tight">
            No guarantee of outcome
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Candid formats your CV so that applicant tracking systems can read
            it, and rewords your experience to match the advert. It cannot
            promise a reply, an interview or a job. Hiring decisions are made by
            employers on grounds Candid has no access to.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-fluid-xl font-semibold tracking-tight">
            Acceptable use
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Upload only your own CV. Do not upload another person&apos;s
            personal information. Automated or bulk use is not permitted, and
            rate limits apply.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-fluid-xl font-semibold tracking-tight">
            Ending your use
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            You can delete your account and everything in it at any time. The
            deletion is immediate and cannot be undone.
          </p>
        </section>
      </div>
    </Container>
    </main>
  );
}
