// Phase 142 — PPE source: LoanPASS (licensed engine, agency/QM breadth). Wraps the
// gated LoanPASS adapter and normalizes its products into PricedProduct. Returns
// status 'gated' (never throws) until a tenant connects a LoanPASS key, so the
// engine keeps running on rate sheets + any other source.
import 'server-only';
import { calculateMonthlyPayment } from '@/lib/pricing/calculator';
import { fetchLoanPassRates } from '@/lib/integrations/ppe/loanpass';
import type { PricingScenario, PricedProduct, SourceResult, RiskyFeatures } from '../types';

const SOURCE_ID = 'loanpass';
const SOURCE_LABEL = 'LoanPASS';

export async function priceFromLoanPass(
  orgId: string,
  leadId: string | null,
  s: PricingScenario,
): Promise<SourceResult> {
  const res = await fetchLoanPassRates(orgId, {
    lead_id: leadId ?? 'ppe-scenario',
    loan_amount: s.loanAmount,
    property_value: s.propertyValue,
    credit_score: s.fico,
    ltv: s.ltv,
    loan_type: s.loanType,
    loan_purpose: s.loanPurpose ?? undefined,
    occupancy: s.occupancy ?? undefined,
    property_type: s.propertyType ?? undefined,
    state: s.state ?? undefined,
    term_years: s.termYears,
    lock_days: s.lockDays,
  });

  if (res.gated) {
    return {
      status: { id: SOURCE_ID, label: SOURCE_LABEL, status: 'gated', note: res.reason, eligibleCount: 0 },
      eligible: [],
      ineligible: [],
    };
  }

  // LoanPASS returns products already eligibility-filtered by its rules engine.
  const eligible: PricedProduct[] = res.quote.products.map((p, i) => {
    const rate = Number(p.rate);
    const termYears = p.term ? Math.round(p.term / 12) : s.termYears;
    const risky: RiskyFeatures = {
      negativeAmortization: !!p.negativeAmortization,
      prepaymentPenalty: !!p.prepaymentPenalty,
      interestOnly: !!p.interestOnly,
      balloon: !!p.balloon,
    };
    return {
      id: `${SOURCE_ID}:${i}`,
      sourceId: SOURCE_ID,
      sourceLabel: SOURCE_LABEL,
      lenderName: SOURCE_LABEL,
      productName: p.productName ?? `${termYears}yr`,
      loanType: s.loanType,
      termYears,
      amortizationType: p.amortizationType ?? 'fixed',
      noteRate: rate,
      basePrice: p.price != null ? Number(p.price) : 100,
      totalAdjustment: 0, // LoanPASS nets adjustments into the returned price
      adjustedPrice: p.price != null ? Number(p.price) : 100,
      lockDays: p.lockDays ?? s.lockDays,
      monthlyPI: Math.round(calculateMonthlyPayment(s.loanAmount, rate, termYears * 12)),
      risky,
      appliedAdjustments: [],
      asOf: new Date().toISOString().slice(0, 10),
      stale: false,
    };
  });

  return {
    status: { id: SOURCE_ID, label: SOURCE_LABEL, status: eligible.length ? 'ok' : 'empty', eligibleCount: eligible.length },
    eligible,
    ineligible: [],
  };
}
