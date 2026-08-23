import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { NOINDEX_HEADER, buildCsp } from '../security-headers';
import { TIMED_OUT, withDeadline } from '../with-deadline';
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

/**
 * How long the auth check may take before we give up on it.
 *
 * This exists because catching an error is not the same as bounding a wait,
 * and the difference took production down.
 *
 * When Supabase is unreachable the client does not reject — it raises
 * `AuthRetryableFetchError` internally and retries. The promise simply stays
 * pending. A try/catch never fires, the platform kills the function at its own
 * limit, and every route returns 504 including the landing page, which needs no
 * authentication at all. Middleware runs on every request, so a slow dependency
 * is a total outage rather than a degraded feature.
 *
 * Three seconds is far more than a JWT verification against cached keys needs
 * and far less than the platform's ceiling. Exceeding it means "not signed in",
 * which is the same safe direction the catch below takes.
 */
const AUTH_TIMEOUT_MS = 3_000;

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
  const pathname = request.nextUrl.pathname;

  /*
   * Middleware runs on every request, including the landing page. If it throws,
   * the whole site returns a 500 — marketing pages included.
   *
   * That is not hypothetical. CI found it: the workflow had no Supabase
   * secrets, so the URL was an empty string, `createServerClient` threw, and
   * every page failed. A misconfigured environment is one cause; Supabase being
   * unreachable for ten minutes is another, and that one will happen.
   *
   * So the auth check is allowed to fail, and failing means "not signed in".
   * On a public path that renders the page as a visitor would see it. On a
   * protected path it redirects to sign-in, which is the safe direction: an
   * outage locks people out rather than letting them through.
   *
   * That reasoning was right and the implementation was incomplete, and the
   * gap became an outage. Catching an error bounds a call that *fails*; it does
   * nothing for a call that *never returns*. Supabase Auth, unable to reach its
   * host, raises AuthRetryableFetchError internally and retries rather than
   * rejecting — so the promise stayed pending, the platform killed the function
   * at its 25-second limit, and every route answered 504 including the landing
   * page. The catch below never ran.
   *
   * The deadline is what makes the paragraph above true rather than merely
   * intended. Both silence and failure now end at "not signed in".
   */
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
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
  //
  // Two independent failure modes, and both must end at "not signed in":
  // the call rejecting, and the call never returning. The second is the one
  // that caused an outage, because only a deadline catches it.
  let signedIn = false;
  try {
    const result = await withDeadline(
      supabase.auth.getClaims(),
      AUTH_TIMEOUT_MS,
    );

    if (result === TIMED_OUT) {
      console.error('[middleware] auth check timed out', {
        ms: AUTH_TIMEOUT_MS,
        pathname,
      });
    } else {
      signedIn = Boolean(result.data?.claims?.sub);
    }
  } catch (cause) {
    // Shape only — never the error object, which can carry request detail.
    console.error('[middleware] auth check failed', {
      name: cause instanceof Error ? cause.name : typeof cause,
      pathname,
    });
    signedIn = false;
  }

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
