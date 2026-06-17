// Phase 142 — PPE source: a licensed pricing engine (Optimal Blue today; LoanPASS /
// Lender Price slot in the same way). Wraps the existing gated OB adapter and
// normalizes its products into PricedProduct. Returns status 'gated' (never throws)
// when no PPE connection is configured, so the engine still runs on rate sheets.
import 'server-only';
import { calculateMonthlyPayment } from '@/lib/pricing/calculator';
import { fetchOBRates } from '@/lib/integrations/ppe/optimalBlue';
import type { PricingScenario, PricedProduct, SourceResult, RiskyFeatures } from '../types';

const SOURCE_ID = 'optimal_blue';
const SOURCE_LABEL = 'Optimal Blue';

const NO_RISK: RiskyFeatures = { negativeAmortization: false, prepaymentPenalty: false, interestOnly: false, balloon: false };

export async function priceFromLicensedPpe(
  orgId: string,
  leadId: string | null,
  s: PricingScenario,
): Promise<SourceResult> {
  const res = await fetchOBRates(orgId, {
    lead_id: leadId ?? 'ppe-scenario',
    loan_amount: s.loanAmount,
    property_value: s.propertyValue,
    credit_score: s.fico,
    property_type: s.propertyType ?? undefined,
    occupancy: s.occupancy ?? undefined,
    loan_purpose: s.loanPurpose ?? undefined,
    loan_type: s.loanType,
    state: s.state ?? undefined,
    lock_days: s.lockDays,
  });

  if (res.gated) {
    return {
      status: { id: SOURCE_ID, label: SOURCE_LABEL, status: 'gated', note: res.reason, eligibleCount: 0 },
      eligible: [],
      ineligible: [],
    };
  }

  // OB returns products already eligibility-filtered by the engine.
  const eligible: PricedProduct[] = res.quote.products
    .filter((p) => p.rate != null)
    .map((p, i) => {
      const rate = Number(p.rate);
      return {
        id: `${SOURCE_ID}:${i}`,
        sourceId: SOURCE_ID,
        sourceLabel: SOURCE_LABEL,
        lenderName: SOURCE_LABEL,
        productName: p.productName ?? `${(p.term ?? 360) / 12}yr`,
        loanType: s.loanType,
        termYears: p.term ? Math.round(p.term / 12) : s.termYears,
        amortizationType: 'fixed',
        noteRate: rate,
        basePrice: p.price != null ? Number(p.price) : 100,
        totalAdjustment: 0, // OB nets adjustments into its returned price
        adjustedPrice: p.price != null ? Number(p.price) : 100,
        lockDays: s.lockDays,
        monthlyPI: Math.round(calculateMonthlyPayment(s.loanAmount, rate, s.termYears * 12)),
        risky: NO_RISK,
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
