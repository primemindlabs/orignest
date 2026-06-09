/**
 * Phase 63.2 — Fannie PIW / Freddie ACE appraisal-waiver eligibility. PURE.
 * Conservative pre-check before ordering an appraisal (DU/LPA makes the final call).
 * Saves ~$500-700 per transaction when a waiver is granted.
 */
export interface WaiverInput {
  loan_type: string; loan_purpose: string; occupancy: 'primary' | 'second_home' | 'investment';
  property_type?: string; ltv: number; prior_appraisal_exists?: boolean;
  is_manufactured?: boolean; is_coop?: boolean; is_new_construction?: boolean; has_renovation?: boolean;
}
export interface WaiverResult { likely_eligible: boolean; confidence: 'high' | 'medium' | 'low'; flags: string[]; criteria: { label: string; pass: boolean }[]; recommendation: string; estimated_savings: number }

const APPRAISAL_COST = 600;
const LTV_LIMITS: Record<string, Record<string, number>> = {
  purchase: { primary: 80, second_home: 80, investment: 75 },
  refinance_rate_term: { primary: 90, second_home: 90, investment: 75 },
  refinance_cashout: { primary: 70, second_home: 60, investment: 60 },
};

export function checkWaiverEligibility(p: WaiverInput): WaiverResult {
  const flags: string[] = [];
  const criteria: { label: string; pass: boolean }[] = [];
  const isConv = ['conventional_conforming', 'conventional_jumbo'].includes(p.loan_type);
  criteria.push({ label: 'Conventional loan type', pass: isConv });
  if (!isConv) {
    return { likely_eligible: false, confidence: 'high', flags: ['FHA/VA/USDA require a full appraisal'], criteria, recommendation: 'Full appraisal required — government loan type.', estimated_savings: 0 };
  }

  let eligible = true;
  const block = (cond: boolean, label: string, flag: string) => { criteria.push({ label, pass: !cond }); if (cond) { eligible = false; flags.push(flag); } };
  block(!!p.is_manufactured, 'Not a manufactured home', 'Manufactured homes: waiver not available');
  block(!!p.is_coop, 'Not a co-op', 'Co-op properties: waiver not available');
  block(!!p.is_new_construction, 'Not new construction', 'New construction: waiver not available');
  block(!!p.has_renovation, 'Not a renovation/construction loan', 'Renovation loans: waiver not available');

  const maxLtv = LTV_LIMITS[p.loan_purpose]?.[p.occupancy];
  const ltvOk = !maxLtv || p.ltv <= maxLtv;
  criteria.push({ label: `LTV ${p.ltv}%${maxLtv ? ` ≤ ${maxLtv}% max` : ''}`, pass: ltvOk });
  if (!ltvOk) { eligible = false; flags.push(`LTV ${p.ltv}% exceeds the ${maxLtv}% waiver max for ${p.loan_purpose}/${p.occupancy}`); }

  let confidence: 'high' | 'medium' | 'low' = eligible ? 'medium' : 'high';
  if (eligible && p.prior_appraisal_exists) confidence = 'high';
  else if (eligible) flags.push('No prior appraisal on file — DU/LPA makes the final determination');

  return {
    likely_eligible: eligible, confidence, flags, criteria,
    recommendation: eligible ? `May qualify for a PIW/ACE waiver. Run through DU or LPA to confirm. Potential savings ~$${APPRAISAL_COST}.` : `Full appraisal required. Disqualifiers: ${flags.join('; ')}.`,
    estimated_savings: eligible ? APPRAISAL_COST : 0,
  };
}
