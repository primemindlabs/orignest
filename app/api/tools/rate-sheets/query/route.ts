// Phase 114 — find the best adjusted price for a borrower profile across the LO's
// active rate sheets. Matching is constrained in SQL; LLPAs applied via the pure lib.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyLlpas, type Llpa } from '@/lib/rateSheets/query';

export async function POST(request: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ results: [] });

  const b = await request.json().catch(() => ({}));
  const fico = Number(b.ficoScore);
  const ltv = Number(b.ltv);
  const loanType = (b.loanType ?? '').toString().toLowerCase();
  const termYears = Number(b.termYears);
  const loanAmount = Number(b.loanAmount) || 0;
  const loanPurpose = b.loanPurpose ? b.loanPurpose.toString() : null;
  if (!Number.isFinite(fico) || !Number.isFinite(ltv) || !loanType || !Number.isFinite(termYears)) {
    return NextResponse.json({ error: 'fico, ltv, loanType, termYears required' }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ results: [] });

  const today = new Date().toISOString().slice(0, 10);
  const { data: sheets } = await sb
    .from('rate_sheets')
    .select('id, lender_name, expiration_date')
    .eq('org_id', orgId)
    .eq('lo_id', profile.id)
    .eq('is_active', true);

  const activeSheets = (sheets ?? []).filter((s) => !s.expiration_date || (s.expiration_date as string) >= today);
  const results: any[] = [];

  for (const sheet of activeSheets) {
    const { data: products } = await sb
      .from('rate_sheet_products')
      .select('*')
      .eq('rate_sheet_id', sheet.id)
      .eq('loan_type', loanType)
      .eq('term_years', termYears);

    const matching = (products ?? []).filter((p) => {
      if (p.min_fico != null && fico < Number(p.min_fico)) return false;
      if (p.max_fico != null && fico > Number(p.max_fico)) return false;
      if (p.max_ltv != null && ltv > Number(p.max_ltv)) return false;
      if (p.min_ltv != null && ltv < Number(p.min_ltv)) return false;
      if (loanAmount > 0 && p.max_loan_amount != null && loanAmount > Number(p.max_loan_amount)) return false;
      if (loanAmount > 0 && p.min_loan_amount != null && loanAmount < Number(p.min_loan_amount)) return false;
      return true;
    });
    if (matching.length === 0) continue;

    const { data: llpaRows } = await sb.from('rate_sheet_llpas').select('*').eq('rate_sheet_id', sheet.id);
    const llpas = (llpaRows ?? []) as unknown as Llpa[];

    for (const p of matching) {
      const price = applyLlpas(p.base_price != null ? Number(p.base_price) : null, llpas, { fico, ltv, loan_purpose: loanPurpose });
      results.push({
        lender_name: sheet.lender_name,
        sheet_id: sheet.id,
        amortization_type: p.amortization_type,
        base_rate: Number(p.base_rate),
        base_price: price.base_price,
        total_llpa: price.total_llpa,
        adjusted_price: price.adjusted_price,
        lock_period_days: p.lock_period_days,
        applied: price.applied,
      });
    }
  }

  // Best price first (highest adjusted price = least cost to the borrower).
  results.sort((a, b2) => b2.adjusted_price - a.adjusted_price || a.base_rate - b2.base_rate);
  return NextResponse.json({ results });
}
