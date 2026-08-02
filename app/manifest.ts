import type { MetadataRoute } from 'next';

/**
 * Web app manifest.
 *
 * `maskable` is a separate file rather than a second `purpose` on the same one.
 * Android crops a maskable icon to whatever shape the launcher uses, so an icon
 * declared maskable must have its artwork inside the safe zone — the rounded
 * tile would lose its corners. `icon-maskable-512.png` is the square-bled
 * version; the others keep their corners.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Candid — an honest CV, tailored',
    short_name: 'Candid',
    description:
      'Tailor your CV to a job advert using only the experience you actually have. Your name, contact details and ID number never reach the AI.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#4338ca',
    lang: 'en-ZA',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
