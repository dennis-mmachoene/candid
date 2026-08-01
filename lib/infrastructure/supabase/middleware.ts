import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { NOINDEX_HEADER, buildCsp } from '../security-headers';
import type { Database } from '@/lib/database.types';

/**
 * Session refresh, security headers, and optimistic redirects only.
 *
 * Server Components cannot write cookies, so something has to refresh the auth
 * token and write it back. That is this.
 *
 * What this is **not** is an authorisation boundary. The redirect below is a
 * convenience: it saves a signed-out visitor a wasted page load. Every
 * authoritative check happens in `lib/dal.ts`, close to the data, because
 * middleware runs before routing and is the wrong place to be the only thing
 * standing between a request and someone's CV. This is also what Next.js's own
 * auth guidance recommends.
 *
 * `getClaims()` rather than `getSession()`: it verifies the JWT signature
 * against the project's published keys. `getSession()` reads the token out of
 * a cookie without revalidating it, and cookies are attacker-controlled.
 */

/** Routes a signed-out user may reach. */
const PUBLIC_PATHS = ['/', '/privacy', '/terms', '/goodbye', '/auth'];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  const { nonce, header: csp } = buildCsp(
    process.env.NODE_ENV === 'development',
  );

  // The nonce must be on the *request* headers too. Next reads the CSP header
  // off the incoming request during SSR and stamps the nonce onto its own
  // framework and bundle scripts. Set it only on the response and every Next
  // script is blocked by the policy we just wrote.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Written twice on purpose: onto the request so Server Components
          // rendering in this same pass see the refreshed token, and onto the
          // response so the browser replaces the stale one.
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Do not remove. This call is what performs the refresh.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const pathname = request.nextUrl.pathname;

  if (!signedIn && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.set('signin', 'required');
    const redirect = NextResponse.redirect(url);
    redirect.headers.set('Content-Security-Policy', csp);
    return redirect;
  }

  response.headers.set('Content-Security-Policy', csp);

  // Signed-in routes carry CV and tailoring ids in the path. The landing page,
  // privacy and terms are the public face of the product and must stay
  // indexable, so this is per-path rather than global.
  if (!isPublicPath(pathname)) {
    response.headers.set(NOINDEX_HEADER.key, NOINDEX_HEADER.value);
  }

  return response;
}
