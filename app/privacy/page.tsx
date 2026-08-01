import { Badge } from '@/components/ui/badge';
import {
  CONSENT_STATEMENTS,
  OPERATORS,
  POLICY_VERSION,
} from '@/lib/domain/consent';

export const metadata = { title: 'Privacy' };

/**
 * The privacy policy is generated from the same constants the consent gate
 * uses. There is no separate prose copy of the operator list to fall out of
 * date, which is the usual way a privacy policy quietly becomes untrue.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="flex flex-col gap-3">
        <Badge variant="brand">Version {POLICY_VERSION}</Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Privacy
        </h1>
        <p className="text-muted-foreground text-pretty">
          Candid processes personal information under the Protection of Personal
          Information Act, 2013. This page is generated from the same
          definitions the application uses, so it cannot drift out of date.
        </p>
      </header>

      <div className="mt-10 flex flex-col gap-10">
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            What Candid promises
          </h2>
          <ul className="text-muted-foreground flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
            {CONSENT_STATEMENTS.map((statement) => (
              <li key={statement}>{statement}</li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            What is collected
          </h2>
          <ul className="text-muted-foreground flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
            <li>
              Your email address, returned by Google when you sign in. No
              password is ever created or stored.
            </li>
            <li>
              The experience, skills and education content of any CV you upload,
              stored with your name, email and phone number removed.
            </li>
            <li>
              Your name, email and phone number from that CV, encrypted with
              AES-256-GCM before they are written to the database.
            </li>
            <li>Any job advert you paste.</li>
            <li>
              A record of your consent, including which version of this policy
              you agreed to.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            What is never collected
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            South African ID numbers. If your CV contains one it is detected
            during processing, replaced with a redaction marker, and discarded
            in memory. There is no database column capable of storing one.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold tracking-tight">
            Who processes it
          </h2>
          {OPERATORS.map((operator) => (
            <div key={operator.name} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
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
          <h2 className="text-xl font-semibold tracking-tight">Your rights</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Under POPIA you may ask what personal information is held about you,
            ask for it to be corrected, and ask for it to be deleted. Deletion
            is built into the product rather than handled by request: one action
            removes every record you own and closes your account immediately.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Changes to this policy
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            If what is shared or who it is shared with changes, the version
            number changes and every user is asked to consent again. Consent
            recorded against an older version stops counting at that point.
          </p>
        </section>
      </div>
    </main>
  );
}
