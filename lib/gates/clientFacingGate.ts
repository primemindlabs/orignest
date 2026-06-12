// Phase 93 — client-facing readiness gates. Before an LO touches a borrower-facing /
// compliance-relevant surface they must have (1) an NMLS number (RESPA/TRID requires it
// on borrower comms) and (2) at least one lender AE in their directory (Phase 89).
//
// Both gates read live state — the AE gate counts lender_ae_connections rather than a
// denormalized flag, so it can never drift out of sync.
import type { SupabaseClient } from '@supabase/supabase-js';

const NMLS_REGEX = /^\d{6,10}$/;

export function isValidNmls(nmls: string | null | undefined): boolean {
  return !!nmls && NMLS_REGEX.test(nmls.trim());
}

/** True when the LO (by profiles.id) has a non-empty NMLS number on file. */
export async function nmlsGate(sb: SupabaseClient<any, any, any>, profileId: string): Promise<boolean> {
  const { data } = await sb.from('profiles').select('nmls_id').eq('id', profileId).maybeSingle();
  return isValidNmls(data?.nmls_id as string | null | undefined);
}

/** True when the LO has at least one active AE in their directory. */
export async function aeGate(sb: SupabaseClient<any, any, any>, profileId: string): Promise<boolean> {
  const { count } = await sb
    .from('lender_ae_connections')
    .select('id', { count: 'exact', head: true })
    .eq('lo_id', profileId)
    .eq('is_active', true);
  return (count ?? 0) > 0;
}

export interface GateStatus {
  nmls_set: boolean;
  ae_passed: boolean;
  ready: boolean;            // all REQUIRED gates passed
  blocking: string[];        // human-readable reasons a client-facing action is blocked
}

/** Combined readiness for the LO. nmls_id may be passed in to avoid a re-query. */
export async function getGateStatus(
  sb: SupabaseClient<any, any, any>,
  profileId: string,
  nmlsId?: string | null,
): Promise<GateStatus> {
  const nmls_set = nmlsId !== undefined ? isValidNmls(nmlsId) : await nmlsGate(sb, profileId);
  const ae_passed = await aeGate(sb, profileId);
  const blocking: string[] = [];
  if (!nmls_set) blocking.push('Add your NMLS number in Settings → Profile.');
  if (!ae_passed) blocking.push('Add at least one lender AE in AE Connect.');
  // Only the NMLS gate hard-blocks borrower comms; the AE gate is readiness guidance.
  return { nmls_set, ae_passed, ready: nmls_set && ae_passed, blocking };
}
