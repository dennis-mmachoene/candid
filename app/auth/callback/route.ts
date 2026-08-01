import { NextResponse } from 'next/server';

import { createClient } from '@/lib/infrastructure/supabase/server';

/**
 * OAuth callback. Google sends the user back here with a one-time code, which
 * we exchange for a session.
 *
 * The redirect target is deliberately not taken from the query string as-is. An
 * open redirect on an auth callback is a phishing primitive: an attacker sends
 * a link that signs the victim in and then bounces them to a lookalike site
 * carrying real session context. Only same-origin relative paths are honoured.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const requested = searchParams.get('next') ?? '/dashboard';

  // A leading single slash and nothing else. Rejects `//evil.com` and
  // `https://evil.com` alike.
  const next = /^\/(?!\/)[\w\-/]*$/.test(requested) ? requested : '/dashboard';

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=auth`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth] code exchange failed', error);
    return NextResponse.redirect(`${origin}/?error=auth`);
  }

  // Where they land is decided by the consent gate in the DAL, not here.
  return NextResponse.redirect(`${origin}${next}`);
}
