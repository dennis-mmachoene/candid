import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Session refresh, and optimistic redirects only.
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
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
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
          response = NextResponse.next({ request });
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

  if (!signedIn && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.set('signin', 'required');
    return NextResponse.redirect(url);
  }

  return response;
}
