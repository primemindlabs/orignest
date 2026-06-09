/**
 * Phase 43.9 — checklist templates per loan type. Ordered item labels assigned to
 * a loan on creation. (Persistence to a checklist table is deferred — loans are
 * `leads` with no loan_files; these drive the create-loan UI today.)
 */
export const DSCR_CHECKLIST = [
  'Purchase agreement or refinance history', 'Property address and APN', 'Current lease agreement (or market rent comps)',
  'Last 12 months rental history (if refinance)', 'Property insurance declaration page', 'Current tax bill',
  'HOA statement (if applicable)', 'Identity (government-issued ID)', 'Entity documents (if LLC — operating agreement, EIN)',
  'Vesting title decision', 'Credit authorization', 'DSCR Worksheet (complete in calculator)', 'Appraisal ordered',
];

export const BANK_STMT_CHECKLIST = [
  'Credit authorization', '12 months personal bank statements OR 24 months business', 'Business license or CPA letter confirming self-employment',
  'YTD P&L (if available)', 'Business tax returns (if corp — 2 years)', 'Entity documents (if LLC)',
  'Purchase agreement or payoff statement', 'Identity (government-issued ID)', 'Property insurance quote',
  'Bank Statement Income Worksheet (complete in analyzer)', 'Appraisal ordered',
];

export const COMMERCIAL_CHECKLIST = [
  'Signed LOI or purchase agreement', '2 years operating tax returns (if existing property)', 'Current rent roll (all tenants, lease terms)',
  '3 months operating statements', 'Year-end operating statement (last 2 years)', 'Environmental Phase 1 (order early)',
  'Property survey (if required by lender)', 'Title commitment', 'Borrower personal financial statement',
  'Borrower 2 years personal tax returns', 'Borrower credit authorization', 'Corporate documents (all entities)',
  'Guarantor information (if applicable)', 'Appraisal ordered (commercial — 3–6 weeks)',
];

export const RESIDENTIAL_CHECKLIST = [
  'Loan application (1003)', 'Credit authorization', 'Last 2 pay stubs', 'Last 2 years W-2s', 'Last 2 months bank statements',
  'Government-issued ID', 'Purchase agreement (if purchase)', 'Homeowners insurance quote', 'Appraisal ordered',
];

export function checklistForLoanType(loanType: string | null | undefined): string[] {
  if (!loanType) return RESIDENTIAL_CHECKLIST;
  if (loanType === 'dscr') return DSCR_CHECKLIST;
  if (loanType === 'non_qm_bank_stmt') return BANK_STMT_CHECKLIST;
  if (loanType.startsWith('non_qm')) return BANK_STMT_CHECKLIST;
  if (loanType.startsWith('commercial')) return COMMERCIAL_CHECKLIST;
  return RESIDENTIAL_CHECKLIST;
}
