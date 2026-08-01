'use server';

import { redirect } from 'next/navigation';

import { publicEnv } from '@/lib/infrastructure/env';
import { createClient } from '@/lib/infrastructure/supabase/server';

/**
 * Google is the only sign-in method, which means Candid never receives, hashes
 * or stores a password. The surest way to avoid leaking credentials is not to
 * hold any.
 */
export async function signInWithGoogle(): Promise<void> {
  const supabase = await createClient();
  const { NEXT_PUBLIC_SITE_URL } = publicEnv();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error || !data.url) {
    console.error('[auth] sign-in failed', error);
    redirect('/?error=auth');
  }

  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
