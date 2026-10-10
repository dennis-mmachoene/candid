import { Badge } from '@/components/ui/badge';
import { Container } from '@/components/ui/container';
import {
  CONSENT_STATEMENTS,
  OPERATORS,
  POLICY_VERSION,
  RETENTION_MONTHS,
} from '@/lib/domain/consent';

export const metadata = { title: 'Privacy' };

/**
 * The privacy page is generated from the same constants the rest of the app
 * uses. There is no separate prose copy of the operator list to fall out of
 * date, which is the usual way a privacy policy quietly becomes untrue.
 */
export default function PrivacyPage() {
  return (
    <main className="py-12 sm:py-16">
      <Container width="prose">
      <header className="flex flex-col gap-3">
        <Badge variant="brand">Version {POLICY_VERSION}</Badge>
        <h1 className="text-fluid-2xl font-semibold tracking-tight">
          Privacy
        </h1>
        <p className="text-muted-foreground text-pretty">
          What Candid keeps, who else sees it, and how to remove it. This page
          is generated from the same definitions the application uses, so it
          cannot drift out of date.
        </p>
      </header>

      <div className="mt-10 flex flex-col gap-10">
        <section className="flex flex-col gap-3">
          <h2 className="text-fluid-xl font-semibold tracking-tight">
            What Candid promises
          </h2>
          <ul className="text-muted-foreground flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
            {CONSENT_STATEMENTS.map((statement) => (
              <li key={statement}>{statement}</li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-fluid-xl font-semibold tracking-tight">
            What is collected
          </h2>
          <ul className="text-muted-foreground flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
            <li>
              Your email address, returned by Google when you sign in. No
              password is ever created or stored.
            </li>
            <li>
              The text of any CV you upload. The file itself is discarded once
              the text has been read out of it.
            </li>
            <li>
              Your name, contact details, location and any links, taken from the
              top of that CV. These fill in your profile, and they are what gets
              printed on a tailored CV so that an application has a name on it.
            </li>
            <li>Any job advert you paste, and every tailored version produced from it.</li>
            <li>
              The applications you send: which role, which CV went with it, and
              where the employer has moved it to.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-fluid-xl font-semibold tracking-tight">
            What is not collected
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Candid never asks for an identity number, a date of birth, a
            photograph or a salary history, and there is no field in the
            database for any of them. If your own CV happens to contain one, it
            is stored as part of your CV text like the rest of the document, and
            it is removed when you delete your CV or your account.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-fluid-xl font-semibold tracking-tight">
            Who can see your CV
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            You, and the employer who posted a role you applied to. That
            employer can read exactly the version you submitted to their role,
            and nothing else you have stored. This is enforced by access
            policies in the database itself rather than by the application, so a
            mistake in a page cannot widen it.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Other applicants cannot see your application, and you cannot see
            theirs.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-fluid-xl font-semibold tracking-tight">
            Who processes it
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Four companies. Each receives the text of your CV, or part of it,
            for the purpose named below and no other.
          </p>
          {OPERATORS.map((operator) => (
            <div key={operator.name} className="flex flex-col gap-1.5">
              <span className="font-medium">{operator.name}</span>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {operator.purpose}
              </p>
              <p className="text-muted-foreground/80 text-xs">
                Processed in: {operator.jurisdiction}
              </p>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-fluid-xl font-semibold tracking-tight">
            How long it is kept
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            A CV you have not used for {RETENTION_MONTHS} months is deleted
            automatically, along with every version tailored from it. Tailoring
            it or downloading it resets that clock.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-fluid-xl font-semibold tracking-tight">Your rights</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            You may ask what is held about you, ask for it to be corrected, and
            ask for it to be deleted. Deletion is built into the product rather
            than handled by request: one action in settings removes every record
            you own and closes your account immediately.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-fluid-xl font-semibold tracking-tight">
            Changes to this page
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            If what is shared, or who it is shared with, changes, the version
            number at the top of this page changes with it.
          </p>
        </section>
      </div>
    </Container>
    </main>
  );
}
