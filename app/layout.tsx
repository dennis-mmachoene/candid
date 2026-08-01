import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Candid — an honest CV, tailored',
  description:
    'Tailor your CV to a job advert using only the experience you actually have. Your name, contact details and ID number never reach the AI.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Fonts are a local system stack rather than next/font/google: fetching a
    // webfont at build time makes the build depend on a third-party network
    // call, which is a fragile thing to put in CI and a needless one here.
    <html lang="en-ZA" suppressHydrationWarning>
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
