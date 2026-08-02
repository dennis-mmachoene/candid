import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';

import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { ThemeProvider } from '@/components/theme-provider';
import { publicEnv } from '@/lib/infrastructure/env';

import './globals.css';

const DESCRIPTION =
  'Tailor your CV to a job advert using only the experience you actually have. Your name, contact details and ID number never reach the AI.';

export const metadata: Metadata = {
  /**
   * Without this, Next resolves the Open Graph image against localhost and
   * logs a warning at build time. `NEXT_PUBLIC_SITE_URL` is already validated
   * as a URL by the Zod schema, so it needs no second check here.
   */
  metadataBase: new URL(publicEnv().NEXT_PUBLIC_SITE_URL),
  title: {
    default: 'Candid — an honest CV, tailored',
    template: '%s — Candid',
  },
  description: DESCRIPTION,
  applicationName: 'Candid',
  openGraph: {
    type: 'website',
    siteName: 'Candid',
    locale: 'en_ZA',
    title: 'Candid — an honest CV, tailored',
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Candid — an honest CV, tailored',
    description: DESCRIPTION,
  },
  /**
   * The icons themselves are picked up from app/icon.svg, app/favicon.ico and
   * app/apple-icon.png by file convention. Only the manifest needs declaring.
   */
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#151520' },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // next-themes writes an inline script before paint so the page never flashes
  // the wrong theme. Under a nonce-based CSP that script is blocked unless it
  // carries the nonce, so it is read here and handed down.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    // `suppressHydrationWarning` is required by next-themes: it writes the
    // theme class onto <html> before React hydrates, which is exactly what
    // stops the flash of the wrong theme, and exactly what React would
    // otherwise complain about.
    <html lang="en-ZA" suppressHydrationWarning>
      {/*
        A local system font stack rather than next/font/google. Fetching a
        webfont at build time makes the build depend on a third-party network
        call, which is a fragile thing to put in CI.
      */}
      <body className="flex min-h-screen flex-col antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
          nonce={nonce}
        >
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
