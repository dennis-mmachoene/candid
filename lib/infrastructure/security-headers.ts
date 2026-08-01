/**
 * Content Security Policy.
 *
 * Nonce-based, with `strict-dynamic`. A fresh nonce per request means an
 * injected `<script>` cannot run unless the attacker guessed a random value
 * they never saw, and `strict-dynamic` means we do not have to maintain a
 * hostname allowlist that quietly rots.
 *
 * Verified against Next's current CSP guidance rather than recalled. Two things
 * from it are load-bearing:
 *
 *   1. The nonce goes on the **request** headers as well as the response. Next
 *      reads the CSP header off the incoming request during SSR and attaches
 *      the nonce to its own framework and bundle scripts. Setting it only on
 *      the response would leave every Next script blocked.
 *   2. Nonces force dynamic rendering. That costs us nothing here: every page
 *      already reads cookies through the header's session check, so nothing in
 *      this app was statically rendered to begin with.
 *
 * `'unsafe-eval'` in development only. React uses `eval` there to reconstruct
 * server-side error stacks in the browser. It is not needed in production and
 * is not granted there.
 */

export interface CspResult {
  nonce: string;
  header: string;
}

export function buildCsp(isDevelopment: boolean): CspResult {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const directives = [
    `default-src 'self'`,

    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
      isDevelopment ? " 'unsafe-eval'" : ''
    }`,

    /*
     * `'unsafe-inline'` for styles, and this is a deliberate, documented
     * compromise rather than an oversight.
     *
     * Style injection is a materially weaker vector than script injection: it
     * can deface a page and, with some effort, exfiltrate limited data via
     * selectors, but it cannot execute. Going nonce-only on styles requires
     * verifying in a production build that nothing Next or React injects
     * inline, and that verification has not been done. Shipping a policy we
     * have not tested, and having it break the app in front of a user, is
     * worse than a scoped compromise we have written down.
     *
     * Upgrade path when someone can test a production build: drop
     * `'unsafe-inline'` and add `'nonce-${nonce}'` here.
     */
    `style-src 'self' 'unsafe-inline'`,

    `img-src 'self' blob: data:`,
    `font-src 'self' data:`,

    // Supabase Auth and Postgrest, over HTTPS and websockets.
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co`,

    // Google's OAuth redirect is a navigation, but some browsers apply
    // form-action to redirects that began as a form submission, and sign-in is
    // a form submission.
    `form-action 'self' https://accounts.google.com`,

    // No plugins, ever.
    `object-src 'none'`,
    // Nothing may rewrite the document base and re-point every relative URL.
    `base-uri 'self'`,
    // Clickjacking. The header equivalent is set too, for older browsers.
    `frame-ancestors 'none'`,
    `frame-src 'none'`,
    // No worker or manifest sources are used; deny rather than inherit.
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
  ];

  if (!isDevelopment) {
    directives.push('upgrade-insecure-requests');
  }

  return { nonce, header: directives.join('; ') };
}

/**
 * Headers that never change per request, so they are set once in
 * `next.config.ts` rather than recomputed in middleware.
 */
export const STATIC_SECURITY_HEADERS: ReadonlyArray<{
  key: string;
  value: string;
}> = [
  // Clickjacking, for browsers predating frame-ancestors.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Stop a browser guessing that a .docx download is really HTML.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Do not leak the path of a page holding a CV id to a third-party site.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Candid needs none of these. Denying is cheaper than auditing later.
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), interest-cohort=()',
  },
  // Two years, subdomains included. Only honoured over HTTPS, so it is inert
  // on localhost and active on Vercel.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // Isolate this origin from cross-origin windows and embeds.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
];

/**
 * Applied per-request in middleware, not globally.
 *
 * Signed-in routes carry CV and tailoring ids in the path and must never be
 * indexed. The landing page, privacy and terms are the opposite: they are the
 * public face of the product and blanket-noindexing them would be a
 * self-inflicted wound.
 */
export const NOINDEX_HEADER = { key: 'X-Robots-Tag', value: 'noindex, nofollow' };
