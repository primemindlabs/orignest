// Phase 82 — assemble the structured, PII-safe context for one loan file (server-only).
// Maps the spec's fictional tables to the REAL schema:
//   rate_lock_alerts        -> rate_lock_expirations (latest)
//   trid_events             -> leads.le_deadline / leads.cd_deadline
//   borrower_engagement_*   -> borrower_behavior_scores (latest)
//   lead.dti                -> dti_worksheets.back_end_dti (latest)
//   conditions              -> loan_conditions (status != 'cleared', condition_text)
// Only the borrower FIRST name is included — no last name / SSN / DOB.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LoanAIContext } from './types';

export async function buildLoanContext(
  sb: SupabaseClient<any, any, any>,
  orgId: string,
  leadId: string,
): Promise<LoanAIContext | null> {
  type LeadRow = {
    id: string;
    org_id: string;
    stage: string | null;
    first_name: string | null;
    loan_amount: number | null;
    loan_type: string | null;
    loan_purpose: string | null;
    property_address: string | null;
    property_city: string | null;
    property_state: string | null;
    occupancy_type: string | null;
    credit_score: number | null;
    ltv: number | null;
    le_deadline: string | null;
    cd_deadline: string | null;
    closing_date: string | null;
    last_contacted_at: string | null;
    assigned_to: string | null;
  };

  const { data: leadData } = await sb
    .from('leads')
    .select(
      'id, org_id, stage, first_name, loan_amount, loan_type, loan_purpose, property_address, ' +
        'property_city, property_state, occupancy_type, credit_score, ltv, le_deadline, cd_deadline, ' +
        'closing_date, last_contacted_at, assigned_to',
    )
    .eq('id', leadId)
    .eq('org_id', orgId) // tenant isolation — never read another org's loan
    .maybeSingle();

  const lead = leadData as LeadRow | null;
  if (!lead) return null;

  const [{ data: lock }, { data: behavior }, { data: dti }, { data: conds }, { data: lo }] =
    await Promise.all([
      sb
        .from('rate_lock_expirations')
        .select('rate, lock_expires_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from('borrower_behavior_scores')
        .select('score')
        .eq('lead_id', leadId)
        .order('computed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from('dti_worksheets')
        .select('back_end_dti')
        .eq('lead_id', leadId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from('loan_conditions')
        .select('condition_text, status')
        .eq('lead_id', leadId)
        .neq('status', 'cleared'),
      lead.assigned_to
        ? sb.from('profiles').select('first_name, last_name').eq('id', lead.assigned_to).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const address = [lead.property_address, lead.property_city, lead.property_state]
    .filter(Boolean)
    .join(', ') || null;

  return {
    lead_id: leadId,
    stage: lead.stage ?? null,
    borrower_name: lead.first_name ?? 'Borrower',
    loan_amount: lead.loan_amount ?? null,
    loan_type: lead.loan_type ?? null,
    loan_purpose: lead.loan_purpose ?? null,
    property_address: address,
    occupancy_type: lead.occupancy_type ?? null,
    credit_score: lead.credit_score ?? null,
    ltv: lead.ltv ?? null,
    rate_lock_expiry: lock?.lock_expires_at ?? null,
    rate_lock_rate: lock?.rate ?? null,
    trid_le_deadline: lead.le_deadline ?? null,
    trid_cd_deadline: lead.cd_deadline ?? null,
    closing_date: lead.closing_date ?? null,
    conditions_outstanding: ((conds ?? []) as { condition_text: string | null }[])
      .map((c) => c.condition_text)
      .filter((t): t is string => !!t),
    ghost_score: behavior?.score ?? null,
    dti_estimated: dti?.back_end_dti ?? null,
    last_contact_date: lead.last_contacted_at ?? null,
    assigned_lo: lo ? `${lo.first_name ?? ''} ${lo.last_name ?? ''}`.trim() || null : null,
  };
}
