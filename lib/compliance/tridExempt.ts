/**
 * Phase 138 — TRID/RESPA applicability per loan file.
 *
 * TRID (and the consumer-mortgage disclosure-timing rules / NMLS-on-comms prompts)
 * apply to CONSUMER-purpose closed-end mortgages. Business-purpose loans —
 * DSCR, other non-QM business-purpose, and commercial — are exempt under Reg Z
 * 1026.3(a). Once a file is classified non-agency or commercial we stop surfacing
 * TRID timelines/warnings (and the NMLS nudge) for that file.
 */
import { classifyLoanType } from '@/lib/loans/loanTypes';

export function isTridExempt(loan: { loan_type?: string | null; loan_category?: string | null }): boolean {
  const cat = (loan.loan_category as string | null) || classifyLoanType(loan.loan_type);
  return cat === 'non_agency' || cat === 'commercial';
}

export const TRID_EXEMPT_NOTE =
  'TRID disclosure-timing rules don’t apply to this business-purpose loan (DSCR / non-QM / commercial), so the LE/CD clock and related warnings are turned off for this file.';
