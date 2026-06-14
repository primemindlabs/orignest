/**
 * Phase 128 — shared signal context. Loaded once per LO per generation run so each
 * signal detector can filter the LO's book without re-querying leads.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LoSignatureContext } from './types';

export interface AutopilotLead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  stage: string | null;
  date_of_birth: string | null;
  referral_realtor_id: string | null;
  referral_source: string | null;
  last_contacted_at: string | null;
  created_at: string;
}

/** Loan stages where active-pipeline signals (conditions, locks, fallout) no longer apply. */
export const TERMINAL_STAGES = new Set(['closed', 'funded', 'lost', 'denied', 'withdrawn', 'dead', 'archived']);

export interface SignalCtx {
  sb: SupabaseClient;
  loId: string;
  orgId: string;
  targetDate: Date;
  lo: LoSignatureContext;
  leads: AutopilotLead[];
  leadById: Map<string, AutopilotLead>;
  leadIds: string[];
  realtorIds: string[];
}

export function fullName(l: { first_name: string | null; last_name: string | null }): string {
  return `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || 'this borrower';
}

export async function buildSignalContext(
  sb: SupabaseClient,
  loId: string,
  orgId: string,
  targetDate: Date,
  lo: LoSignatureContext,
): Promise<SignalCtx> {
  const { data } = await sb
    .from('leads')
    .select('id, first_name, last_name, phone, email, stage, date_of_birth, referral_realtor_id, referral_source, last_contacted_at, created_at')
    .eq('org_id', orgId)
    .eq('assigned_to', loId)
    .limit(5000);

  const leads = (data ?? []) as AutopilotLead[];
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const realtorIds = [...new Set(leads.map((l) => l.referral_realtor_id).filter((x): x is string => !!x))];

  return { sb, loId, orgId, targetDate, lo, leads, leadById, leadIds: leads.map((l) => l.id), realtorIds };
}
