import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/orgContext';
import { deriveLoanContext, type LoanContext } from '@/lib/ui/fieldAdapter';

export interface LoanSummary {
  id: string;
  orgId: string;
  borrowerName: string;
  loanAmount: number | null;
  programLabel: string;
  transactionLabel: string;
  propertyAddress: string | null;
  stage: string;
  loId: string | null;
  // KPI pill data
  dti: number | null;
  riskScore: number | null;
  lockExpiresAt: string | null;
  lockStatus: string | null;
  openConditions: number;
  // Adaptive context
  context: LoanContext;
}

const PROGRAM_LABELS: Record<string, string> = {
  conventional: 'Conv', fha: 'FHA', va: 'VA', usda: 'USDA', jumbo: 'Jumbo',
  non_qm: 'Non-QM', dscr: 'DSCR', heloc: 'HELOC', construction: 'Construction',
  reverse: 'Reverse', commercial: 'Commercial',
};
const TRANSACTION_LABELS: Record<string, string> = {
  purchase: 'Purchase', rate_term_refinance: 'Rate/Term Refi',
  cash_out_refinance: 'Cash-Out Refi', heloc: 'HELOC', construction: 'Construction',
};

/**
 * Single server-side fetch for the loan-file header + adaptive context.
 * Not wrapped in unstable_cache: the admin client + per-request org resolution
 * make a plain dynamic read the safest correct choice (revalidation tags would
 * need wiring into every mutation path). Header data is small and indexed.
 */
export async function getLoanSummary(loanId: string): Promise<LoanSummary | null> {
  const { orgId } = await getOrgContext();
  if (!orgId) return null;

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('id, first_name, last_name, loan_amount, loan_type, loan_purpose, occupancy_type, property_type, down_payment, estimated_value, property_address, property_city, property_state, property_zip, stage, assigned_to')
    .eq('id', loanId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!lead) return null;

  const [{ data: dtiRow }, { data: uwRow }, { data: lockRow }, { count: openConditions }, { data: appRow }] =
    await Promise.all([
      sb.from('dti_worksheets').select('back_end_dti').eq('lead_id', loanId).maybeSingle(),
      sb.from('uw_files').select('risk_score').eq('lead_id', loanId).maybeSingle(),
      sb.from('rate_lock_expirations').select('lock_expires_at, status').eq('lead_id', loanId).maybeSingle(),
      sb.from('loan_conditions').select('id', { count: 'exact', head: true }).eq('lead_id', loanId).neq('status', 'cleared'),
      sb.from('loan_applications').select('borrower_data').eq('lead_id', loanId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

  const borrowerData = (appRow?.borrower_data ?? {}) as Record<string, unknown>;
  const context = deriveLoanContext(lead, {
    has_co_borrower: !!borrowerData.has_co_borrower || !!borrowerData.co_borrower_section,
    has_reo: !!borrowerData.has_reo,
  });

  const addressParts = [lead.property_address, lead.property_city, [lead.property_state, lead.property_zip].filter(Boolean).join(' ')].filter(Boolean);

  return {
    id: lead.id,
    orgId,
    borrowerName: `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim(),
    loanAmount: lead.loan_amount,
    programLabel: PROGRAM_LABELS[lead.loan_type ?? ''] ?? '—',
    transactionLabel: TRANSACTION_LABELS[lead.loan_purpose ?? ''] ?? '—',
    propertyAddress: addressParts.length ? addressParts.join(', ') : null,
    stage: lead.stage,
    loId: lead.assigned_to,
    dti: dtiRow?.back_end_dti != null ? Number(dtiRow.back_end_dti) : null,
    riskScore: uwRow?.risk_score != null ? Number(uwRow.risk_score) : null,
    lockExpiresAt: lockRow?.lock_expires_at ?? null,
    lockStatus: lockRow?.status ?? null,
    openConditions: openConditions ?? 0,
    context,
  };
}
