// Phase 115 — update or remove a scenario. Editable numeric fields recompute metrics.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeScenarioMetrics } from '@/lib/scenarios/compute';

type Ctx = { params: { loanId: string; id: string } };
const num = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

export async function PATCH(request: Request, { params }: Ctx) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const sb = createAdminClient();

  const { data: cur } = await sb
    .from('loan_scenarios')
    .select('*')
    .eq('id', params.id)
    .eq('org_id', orgId)
    .eq('lead_id', params.loanId)
    .maybeSingle();
  if (!cur) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.scenario_name !== undefined) updates.scenario_name = b.scenario_name.toString().slice(0, 120);
  if (b.is_visible_to_borrower !== undefined) updates.is_visible_to_borrower = !!b.is_visible_to_borrower;

  // Recompute when any numeric driver changes.
  const drivers = ['purchase_price', 'down_payment_pct', 'interest_rate', 'loan_term_months', 'loan_type'];
  if (drivers.some((d) => b[d] !== undefined)) {
    const purchase = num(b.purchase_price ?? cur.purchase_price);
    const downPct = num(b.down_payment_pct ?? cur.down_payment_pct);
    const rate = num(b.interest_rate ?? cur.interest_rate);
    const term = Math.round(num(b.loan_term_months ?? cur.loan_term_months, 360));
    const m = computeScenarioMetrics({ purchase_price: purchase, down_payment_pct: downPct, interest_rate: rate, loan_term_months: term });
    Object.assign(updates, {
      purchase_price: purchase,
      down_payment_pct: downPct,
      interest_rate: rate,
      loan_term_months: term,
      loan_amount: m.loan_amount,
      monthly_payment: m.monthly_payment,
      total_interest_paid: m.total_interest_paid,
      total_cost_of_loan: m.total_cost_of_loan,
    });
    if (b.loan_type !== undefined) updates.loan_type = b.loan_type.toString();
  }

  // Single recommended per loan.
  if (b.is_recommended === true) {
    await sb.from('loan_scenarios').update({ is_recommended: false }).eq('org_id', orgId).eq('lead_id', params.loanId);
    updates.is_recommended = true;
  } else if (b.is_recommended === false) {
    updates.is_recommended = false;
  }

  const { data, error } = await sb
    .from('loan_scenarios')
    .update(updates)
    .eq('id', params.id)
    .eq('org_id', orgId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ scenario: data });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { error } = await sb.from('loan_scenarios').delete().eq('id', params.id).eq('org_id', orgId).eq('lead_id', params.loanId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
