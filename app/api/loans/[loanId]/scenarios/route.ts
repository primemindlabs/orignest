// Phase 115 — per-loan scenarios: list + create. Org + LO scoped.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeScenarioMetrics } from '@/lib/scenarios/compute';

const LOAN_TYPES = ['conventional', 'fha', 'va', 'dscr', 'jumbo', 'arm_5_1', 'arm_7_1'];
const num = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

export async function GET(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ scenarios: [] });

  const sb = createAdminClient();
  const { data } = await sb
    .from('loan_scenarios')
    .select('*')
    .eq('org_id', orgId)
    .eq('lead_id', params.loanId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  return NextResponse.json({ scenarios: data ?? [] });
}

export async function POST(request: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const loanType = (b.loan_type ?? 'conventional').toString();
  if (!LOAN_TYPES.includes(loanType)) return NextResponse.json({ error: 'Invalid loan_type' }, { status: 400 });

  const purchasePrice = num(b.purchase_price);
  const downPct = num(b.down_payment_pct);
  const rate = num(b.interest_rate);
  const term = Math.round(num(b.loan_term_months, 360));
  if (purchasePrice <= 0 || rate <= 0) return NextResponse.json({ error: 'purchase_price and interest_rate required' }, { status: 400 });

  const m = computeScenarioMetrics({ purchase_price: purchasePrice, down_payment_pct: downPct, interest_rate: rate, loan_term_months: term });

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { count } = await sb
    .from('loan_scenarios')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('lead_id', params.loanId);

  const { data, error } = await sb
    .from('loan_scenarios')
    .insert({
      org_id: orgId,
      lo_id: profile.id,
      lead_id: params.loanId,
      scenario_name: (b.scenario_name ?? `Scenario ${(count ?? 0) + 1}`).toString().slice(0, 120),
      sort_order: count ?? 0,
      loan_type: loanType,
      purchase_price: purchasePrice,
      down_payment_pct: downPct,
      loan_amount: m.loan_amount,
      interest_rate: rate,
      loan_term_months: term,
      monthly_payment: m.monthly_payment,
      total_interest_paid: m.total_interest_paid,
      total_cost_of_loan: m.total_cost_of_loan,
      lender_name: b.lender_name ? b.lender_name.toString().slice(0, 120) : null,
      rate_sheet_id: b.rate_sheet_id ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ scenario: data }, { status: 201 });
}
