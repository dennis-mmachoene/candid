import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

import { Container } from '@/components/ui/container';
import { POLICY_VERSION } from '@/lib/domain/consent';

const sections = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', href: '/#how' },
      { label: 'Our promises', href: '/#promises' },
      { label: 'What we refuse to do', href: '/#refusals' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-muted/30 mt-16 border-t sm:mt-24">
      <Container className="py-10 sm:py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-3 lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="border-brand-500/30 bg-brand-500/10 grid size-8 place-items-center rounded-md border">
                <ShieldCheck
                  className="text-brand-700 dark:text-brand-300 size-4"
                  aria-hidden
                />
              </span>
              <span className="font-display text-base font-semibold tracking-tight">
                Candid
              </span>
            </div>
            <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
              An honest CV, tailored to the job. Built for South African job
              seekers, and built so that nothing on your CV is anything you
              cannot defend in the interview.
            </p>
          </div>

          {sections.map((section) => (
            <div key={section.title} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold">{section.title}</h3>
              <ul className="flex flex-col gap-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground rounded-sm text-sm underline-offset-4 transition-colors hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-xs">
            Candid processes personal information under POPIA. Privacy policy
            version <span className="font-mono">{POLICY_VERSION}</span>.
          </p>
          <p className="text-muted-foreground text-xs">
            Your ID number is never stored. There is no column for one.
          </p>
        </div>
      </Container>
    </footer>
  );
}
