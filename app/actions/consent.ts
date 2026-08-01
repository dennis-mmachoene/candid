'use server';

import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/dal';
import { OPERATORS, POLICY_VERSION } from '@/lib/domain/consent';
import { toJson } from '@/lib/infrastructure/persisted-schemas';
import { createClient } from '@/lib/infrastructure/supabase/server';

/**
 * Record POPIA consent.
 *
 * The operator list is snapshotted into the row rather than referenced, so the
 * record shows what the user was actually told, not what the code says today.
 * If the operators change later, the old record still reflects the old terms —
 * which is the point of keeping it.
 *
 * The policy version is taken from the server constant, never from the form.
 * A client-supplied version would let anyone consent to a policy that does not
 * exist and skip the gate.
 */
export async function acceptConsent(): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from('consent_records').insert({
    policy_version: POLICY_VERSION,
    operators: toJson(OPERATORS),
  });

  if (error) {
    console.error('[consent] insert failed', { userId: user.id, error });
    redirect('/consent?error=1');
  }

  await supabase.rpc('log_audit_event', {
    p_action: 'consent.accepted',
    p_metadata: { policy_version: POLICY_VERSION },
  });

  redirect('/dashboard');
}
