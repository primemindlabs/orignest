/**
 * Phase 148 — load Loan Estimate inputs + issue a disclosure package. SERVER-ONLY.
 *
 * loadLeInput assembles the LoanEstimateInput from the latest application's loan_data
 * (falling back to the lead's synced fields) + a fee worksheet. issueDisclosure
 * persists the computed package, mints a borrower delivery token, and logs an
 * le_issued trid_event so the existing TRID clock (P84) tracks the 3-business-day
 * deadline from the application date.
 */
import 'server-only';
import { randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getLoanEstimateDeadline } from '@/lib/compliance/trid';
import { buildLoanEstimate, type FeeWorksheet, type LoanEstimateInput, type LoanEstimate } from '@/lib/disclosures/buildLoanEstimate';

type Admin = SupabaseClient<any, any, any>;

export async function loadLeInput(sb: Admin, orgId: string, leadId: string, fees: FeeWorksheet): Promise<{ input: LoanEstimateInput; applicationDate: string | null } | null> {
  const { data: lead } = await sb.from('leads').select('loan_amount, rate, term, loan_type, loan_purpose, property_address, property_city, property_state, property_zip, purchase_price, estimated_value').eq('id', leadId).eq('org_id', orgId).maybeSingle();
  if (!lead) return null;
  const { data: app } = await sb.from('loan_applications').select('loan_data, created_at, submitted_at').eq('lead_id', leadId).eq('org_id', orgId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  const loan = ((app?.loan_data ?? {}) as Record<string, any>);
  const L = lead as Record<string, any>;

  const num = (v: unknown): number => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const termMonths = num(loan.loan_term_months) || (num(L.term) ? num(L.term) * 12 : 360);
  const addr = [loan.subject_property_address ?? L.property_address, L.property_city, L.property_state, L.property_zip].filter(Boolean).join(', ') || null;

  return {
    input: {
      loanAmount: num(loan.loan_amount ?? L.loan_amount),
      interestRate: num(loan.interest_rate ?? L.rate),
      termMonths,
      loanType: loan.loan_type ?? L.loan_type ?? null,
      loanPurpose: loan.loan_purpose ?? L.loan_purpose ?? null,
      amortizationType: loan.amortization_type ?? null,
      purchasePrice: (loan.purchase_price ?? L.purchase_price ?? null) as number | null,
      propertyAddress: addr,
      fees,
    },
    applicationDate: (app?.submitted_at ?? app?.created_at ?? null) as string | null,
  };
}

export async function previewLoanEstimate(sb: Admin, orgId: string, leadId: string, fees: FeeWorksheet): Promise<LoanEstimate | null> {
  const loaded = await loadLeInput(sb, orgId, leadId, fees);
  if (!loaded) return null;
  return buildLoanEstimate(loaded.input);
}

export async function issueDisclosure(
  sb: Admin, orgId: string, leadId: string, loId: string | null, fees: FeeWorksheet,
): Promise<{ ok: false; error: string } | { ok: true; pkg: Record<string, any> }> {
  const loaded = await loadLeInput(sb, orgId, leadId, fees);
  if (!loaded) return { ok: false, error: 'Loan not found.' };
  const le = buildLoanEstimate(loaded.input);
  const token = randomBytes(24).toString('hex');
  const now = new Date();

  const { data: pkg, error } = await sb.from('disclosure_packages').insert({
    org_id: orgId, lead_id: leadId, lo_id: loId, package_type: 'le', status: 'issued',
    le_data: le as unknown as Record<string, unknown>, delivery_token: token, issued_at: now.toISOString(),
  }).select('id, status, delivery_token, issued_at').single();
  if (error || !pkg) return { ok: false, error: 'Could not issue the disclosure.' };

  // Log the TRID le_issued event so the existing clock tracks the 3-business-day rule.
  const appDate = loaded.applicationDate ? new Date(loaded.applicationDate) : now;
  const deadline = getLoanEstimateDeadline(appDate);
  await sb.from('trid_events').insert({
    org_id: orgId, lead_id: leadId, user_id: loId, event_type: 'le_issued',
    event_date: now.toISOString().slice(0, 10),
    deadline_date: deadline.toISOString().slice(0, 10),
    is_compliant: now.getTime() <= deadline.getTime(),
    notes: 'Loan Estimate generated and issued via Disclosure Generator (P148).',
  }).then(() => undefined, () => undefined);

  return { ok: true, pkg };
}
