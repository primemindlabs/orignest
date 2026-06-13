// Phase 112 — DSCR analyzer: compute (server) + persist an INSERT-only analysis.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { analyzeDscr, type DscrInputs } from '@/lib/dscr/analyzer';

const num = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

export async function POST(request: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const unitCount = Math.min(9, Math.max(1, Math.round(num(body.unit_count, 1))));

  const inputs: DscrInputs = {
    unit_count: unitCount,
    gross_monthly_rent: num(body.gross_monthly_rent),
    vacancy_rate_pct: num(body.vacancy_rate_pct, 5),
    monthly_taxes: num(body.monthly_taxes),
    monthly_insurance: num(body.monthly_insurance),
    monthly_hoa: num(body.monthly_hoa),
    management_pct: num(body.management_pct, 8),
    maintenance_pct: num(body.maintenance_pct, 5),
    capex_reserve_pct: num(body.capex_reserve_pct, 3),
    loan_amount: num(body.loan_amount),
    interest_rate: num(body.interest_rate),
    loan_term_months: Math.round(num(body.loan_term_months, 360)),
  };

  const result = analyzeDscr(inputs);

  // Persist only when there's a real property to record (the live preview doesn't save).
  if (body.persist) {
    const sb = createAdminClient();
    const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
    await sb.from('dscr_analyses').insert({
      org_id: orgId,
      lo_id: profile?.id ?? null,
      lead_id: body.lead_id ?? null,
      property_address: (body.property_address ?? '').toString().slice(0, 300) || 'Untitled property',
      unit_count: unitCount,
      property_type: result.property_type,
      gross_monthly_rent: inputs.gross_monthly_rent,
      vacancy_rate_pct: inputs.vacancy_rate_pct,
      monthly_taxes: inputs.monthly_taxes,
      monthly_insurance: inputs.monthly_insurance,
      monthly_hoa: inputs.monthly_hoa,
      management_pct: inputs.management_pct,
      maintenance_pct: inputs.maintenance_pct,
      capex_reserve_pct: inputs.capex_reserve_pct,
      purchase_price: body.purchase_price != null ? num(body.purchase_price) : null,
      loan_amount: inputs.loan_amount,
      interest_rate: inputs.interest_rate,
      loan_term_months: inputs.loan_term_months,
      total_operating_expenses: result.total_operating_expenses,
      net_operating_income: result.net_operating_income,
      monthly_debt_service: result.monthly_debt_service,
      dscr: result.dscr,
      qualifies: result.qualifies,
      notes: result.notes,
    });
  }

  return NextResponse.json({ result });
}
