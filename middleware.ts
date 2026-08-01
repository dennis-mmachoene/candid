import type { NextRequest } from 'next/server';

import { updateSession } from '@/lib/infrastructure/supabase/middleware';

/**
 * Next 15.5 uses `middleware.ts`. Supabase's current docs show `proxy.ts`,
 * which is the Next 16 rename — verified against the installed package
 * (`MIDDLEWARE_FILENAME = 'middleware'` in next/dist/lib/constants.js) rather
 * than assumed. When this project moves to Next 16, this file becomes
 * `proxy.ts` and the export becomes `proxy`.
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets and images. The session refresh has to
    // run on real page requests; running it on every icon is waste.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
