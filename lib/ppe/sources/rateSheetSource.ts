// Phase 142 — PPE source: the LO's own ingested rate sheets (P114 tables).
// This is the proprietary engine over real data: eligibility-filter, then apply
// the multi-dimensional adjustment stack, normalize to PricedProduct.
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateMonthlyPayment } from '@/lib/pricing/calculator';
import { applyAdjustments, type AdjusterRow } from '../adjustments';
import { evaluateEligibility, type ProductConstraints } from '../eligibility';
import type { PricingScenario, PricedProduct, IneligibleProduct, SourceResult, RiskyFeatures } from '../types';

const SOURCE_ID = 'rate_sheet';
const SOURCE_LABEL = 'Rate sheet';

function riskyFromProduct(p: Record<string, unknown>): RiskyFeatures {
  const amort = String(p.amortization_type ?? '').toLowerCase();
  return {
    negativeAmortization: !!p.neg_am || amort.includes('neg'),
    prepaymentPenalty: !!p.prepay_penalty || amort.includes('prepay'),
    interestOnly: !!p.interest_only || amort.includes('io') || amort.includes('interest only'),
    balloon: !!p.balloon || amort.includes('balloon'),
  };
}

export async function priceFromRateSheets(
  sb: SupabaseClient,
  orgId: string,
  loId: string,
  s: PricingScenario,
): Promise<SourceResult> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: sheets } = await sb
    .from('rate_sheets')
    .select('id, lender_name, effective_date, expiration_date')
    .eq('org_id', orgId)
    .eq('lo_id', loId)
    .eq('is_active', true);

  const active = (sheets ?? []).filter((sh) => !sh.expiration_date || (sh.expiration_date as string) >= today);
  const eligible: PricedProduct[] = [];
  const ineligible: IneligibleProduct[] = [];

  for (const sheet of active) {
    const { data: products } = await sb
      .from('rate_sheet_products')
      .select('*')
      .eq('rate_sheet_id', sheet.id)
      .eq('loan_type', s.loanType.toLowerCase())
      .eq('term_years', s.termYears);
    if (!products || products.length === 0) continue;

    const { data: llpaRows } = await sb.from('rate_sheet_llpas').select('*').eq('rate_sheet_id', sheet.id);
    const adjusters = (llpaRows ?? []) as unknown as AdjusterRow[];
    const stale = !!sheet.effective_date && (sheet.effective_date as string) < today;

    for (const p of products) {
      const constraints: ProductConstraints = {
        loan_type: p.loan_type,
        term_years: p.term_years,
        min_fico: p.min_fico, max_fico: p.max_fico,
        min_ltv: p.min_ltv, max_ltv: p.max_ltv,
        min_loan_amount: p.min_loan_amount, max_loan_amount: p.max_loan_amount,
      };
      const verdict = evaluateEligibility(constraints, s);
      const productName = `${p.term_years}yr ${p.amortization_type ?? 'Fixed'}`;

      if (!verdict.eligible) {
        ineligible.push({ lenderName: sheet.lender_name, productName, sourceLabel: SOURCE_LABEL, reasons: verdict.reasons });
        continue;
      }

      const price = applyAdjustments(
        p.base_price != null ? Number(p.base_price) : null,
        adjusters,
        s,
        String(p.amortization_type ?? 'fixed'),
      );

      eligible.push({
        id: `${SOURCE_ID}:${p.id}`,
        sourceId: SOURCE_ID,
        sourceLabel: SOURCE_LABEL,
        lenderName: sheet.lender_name,
        productName,
        loanType: p.loan_type,
        termYears: p.term_years,
        amortizationType: String(p.amortization_type ?? 'fixed'),
        noteRate: Number(p.base_rate),
        basePrice: price.basePrice,
        totalAdjustment: price.totalAdjustment,
        adjustedPrice: price.adjustedPrice,
        lockDays: p.lock_period_days ?? s.lockDays,
        monthlyPI: Math.round(calculateMonthlyPayment(s.loanAmount, Number(p.base_rate), s.termYears * 12)),
        risky: riskyFromProduct(p),
        appliedAdjustments: price.applied,
        asOf: (sheet.effective_date as string) ?? null,
        stale,
      });
    }
  }

  const status = {
    id: SOURCE_ID,
    label: SOURCE_LABEL,
    status: active.length === 0 ? ('empty' as const) : ('ok' as const),
    note: active.length === 0 ? 'No active rate sheets ingested yet' : undefined,
    eligibleCount: eligible.length,
  };
  return { status, eligible, ineligible };
}
