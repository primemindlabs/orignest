// Phase 119 — portal verification gate. Available for routes that should require a
// verified borrower (BSA/AML). NOT enforced on existing flows by default (existing
// borrowers have no record yet) — opt-in per route.
import type { SupabaseClient } from '@supabase/supabase-js';

export type VerificationState = 'verified' | 'pending' | 'unverified';

export async function verificationGate(
  sb: SupabaseClient<any, any, any>,
  orgId: string,
  leadId: string
): Promise<VerificationState> {
  const { data } = await sb
    .from('identity_verifications')
    .select('status')
    .eq('org_id', orgId)
    .eq('lead_id', leadId)
    .maybeSingle();
  if (!data) return 'unverified';
  return data.status === 'verified' ? 'verified' : 'pending';
}
