/**
 * Phase 33.3 — RESPA Section 8 co-marketing budget split check.
 *
 * Co-marketing is permitted ONLY if each party pays proportional to the benefit
 * they receive. An LO paying the lion's share of a realtor-promoting ad can be an
 * improper referral fee. This is surfaced prominently in the UI, not buried.
 */

export interface CoopAdBudgetSplit {
  lo_percentage: number;
  realtor_percentage: number;
}

export interface CoopBudgetResult {
  compliant: boolean;
  warning?: string;
}

export function validateCoopBudgetSplit(split: CoopAdBudgetSplit): CoopBudgetResult {
  const { lo_percentage, realtor_percentage } = split;

  if (lo_percentage + realtor_percentage !== 100) {
    return { compliant: false, warning: 'Percentages must sum to 100%.' };
  }
  if (lo_percentage < 0 || realtor_percentage < 0) {
    return { compliant: false, warning: 'Percentages cannot be negative.' };
  }

  // RESPA safe harbor: warn if the LO pays >70% of a co-marketing ad.
  if (lo_percentage > 70) {
    return {
      compliant: false,
      warning: `RESPA Warning: LO paying ${lo_percentage}% of a co-marketing ad may constitute an improper referral fee. Consult your compliance officer. Safe range: 40–60% LO / 40–60% Realtor for ads with balanced promotion.`,
    };
  }

  return { compliant: true };
}
