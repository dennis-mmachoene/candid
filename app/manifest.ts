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
    /*
     * These two are the resolved sRGB values of --background and --brand-600
     * from globals.css. The manifest is plain JSON served to the operating
     * system, so it cannot read a CSS custom property or an oklch() value —
     * they have to be written out. If the palette moves again, these move with
     * it, or the splash screen and the task-switcher tint go stale.
     */
    background_color: '#fdfaf5',
    theme_color: '#007274',
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
