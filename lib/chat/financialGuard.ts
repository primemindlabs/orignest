/**
 * Phase 31.1 — Financial content guard for chat.
 *
 * Financial data must never reach a realtor. detectFinancialContent() flags a
 * message (LO may still need to reference a stage); validateMessageForRealtor()
 * HARD-BLOCKS at the API layer when a message would be visible to a realtor.
 */

const FINANCIAL_KEYWORDS = [
  'dti', 'debt to income', 'debt-to-income', 'credit score', 'fico', 'income', 'salary',
  'assets', 'bank account', 'appraisal value', 'apr', 'interest rate', 'rate lock',
  'loan amount', 'down payment', 'ltv', 'loan to value', 'loan-to-value', 'pmi', 'mip',
  'underwriting', 'denial', 'denied', 'adverse action', 'fair lending',
];

export function detectFinancialContent(content: string): boolean {
  const lower = content.toLowerCase();
  return FINANCIAL_KEYWORDS.some((kw) => lower.includes(kw));
}

export class FinancialContentError extends Error {
  constructor() {
    super(
      'This message contains financial information that cannot be shared with realtors. ' +
        'Remove the financial details or send this message to the borrower only.'
    );
    this.name = 'FinancialContentError';
  }
}

/** Throws FinancialContentError if a realtor-visible message contains financial content. */
export function validateMessageForRealtor(content: string): void {
  if (detectFinancialContent(content)) throw new FinancialContentError();
}
