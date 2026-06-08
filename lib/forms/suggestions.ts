/**
 * Phase 18 — Smart 1003 inline suggestions.
 *
 * Deterministic, real-time guidance shown while the LO/borrower fills the 1003.
 * Deterministic (not LLM) on purpose: these are precise underwriting rules that
 * must fire instantly and consistently as fields change.
 */
export interface FormSuggestion {
  id: string;
  severity: 'info' | 'warning';
  message: string;
}

export interface SmartFormValues {
  credit_score?: number | null;
  ltv?: number | null;
  loan_type?: string | null;
  loan_amount?: number | null;
  employment_type?: string | null;
  business_shows_loss?: boolean | null;
  employment_gap_months?: number | null;
}

// Rough monthly PMI estimate: ~0.5%/yr of loan amount at >80% LTV.
function estimatePmiMonthly(loanAmount: number): number {
  return Math.round((loanAmount * 0.005) / 12);
}

export function getFormSuggestions(v: SmartFormValues): FormSuggestion[] {
  const out: FormSuggestion[] = [];

  if (typeof v.credit_score === 'number' && v.credit_score > 0 && v.credit_score < 620) {
    out.push({
      id: 'low_credit',
      severity: 'warning',
      message:
        'This score may limit options to FHA 203(k) or portfolio programs. Consider reviewing the credit-improvement pathway.',
    });
  }

  if (
    typeof v.ltv === 'number' &&
    v.ltv > 80 &&
    (v.loan_type === 'conventional' || v.loan_type == null)
  ) {
    const est = v.loan_amount ? `~$${estimatePmiMonthly(v.loan_amount).toLocaleString()}/mo` : 'an added monthly cost';
    out.push({
      id: 'pmi',
      severity: 'info',
      message: `PMI will apply at this LTV (est. ${est}). A lender-paid PMI option may be available.`,
    });
  }

  if (typeof v.employment_gap_months === 'number' && v.employment_gap_months > 6) {
    out.push({
      id: 'employment_gap',
      severity: 'warning',
      message:
        'Underwriters will ask about the employment gap — consider adding a letter of explanation to the conditions list now.',
    });
  }

  if (v.employment_type === 'self_employed' && v.business_shows_loss) {
    out.push({
      id: 'self_employed_loss',
      severity: 'warning',
      message:
        'Self-employed borrowers showing a business loss may be declined under agency guidelines. Bank-statement / non-QM programs may fit better.',
    });
  }

  return out;
}
