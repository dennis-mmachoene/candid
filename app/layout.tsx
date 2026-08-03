import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { headers } from 'next/headers';

import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { ThemeProvider } from '@/components/theme-provider';
import { publicEnv } from '@/lib/infrastructure/env';

import './globals.css';

/*
 * Fonts are self-hosted through next/font/local, not fetched from a font CDN.
 *
 * next/font copies the files into the build and serves them from our own
 * origin, so there is no third-party request at runtime, nothing for the
 * Content-Security-Policy to allow beyond `font-src 'self'`, and no font
 * provider watching who reads the page. Both files are variable, so a single
 * request per face covers every weight the interface uses.
 *
 *   - Bricolage Grotesque carries the headlines and section titles: a display
 *     grotesque with real character, which is where "not a template" lives.
 *   - Hanken Grotesk is the body and UI face: clean, warm and highly legible.
 */
const bricolage = localFont({
  src: './fonts/bricolage-grotesque-variable.woff2',
  variable: '--font-bricolage',
  weight: '200 800',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
});

const hanken = localFont({
  src: './fonts/hanken-grotesk-variable.woff2',
  variable: '--font-hanken',
  weight: '100 900',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
});

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
  /* The warm paper and warm near-black page colours, so the browser chrome
     matches the page rather than framing it in a cooler white or black. */
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf8f3' },
    { media: '(prefers-color-scheme: dark)', color: '#1b1a17' },
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
    //
    // The two font variables are set here on <html> so every surface, including
    // the pre-paint theme script's target, can resolve them.
    <html
      lang="en-ZA"
      suppressHydrationWarning
      className={`${hanken.variable} ${bricolage.variable}`}
    >
      <body className="flex min-h-screen flex-col font-sans antialiased">
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
