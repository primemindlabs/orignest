/**
 * Phase 41 — LOS status → Ashley IQ pipeline stage. Maps onto the REAL
 * leads.stage CHECK values (new_inquiry, pre_qual, application, processing,
 * underwriting, conditional_approval, clear_to_close, closed, declined,
 * withdrawn) — there is no separate 'funded'/'closing' stage, so Funded→closed
 * and Docs-Out→clear_to_close.
 */
export const LENDINGPAD_STATUS_MAP: Record<string, string> = {
  'Application': 'application',
  'Processing': 'processing',
  'Submitted to UW': 'underwriting',
  'Conditional Approval': 'conditional_approval',
  'Clear to Close': 'clear_to_close',
  'Docs Out': 'clear_to_close',
  'Funded': 'closed',
  'Withdrawn': 'withdrawn',
  'Denied': 'declined',
};

// Arive statuses → leads.stage. Lead statuses (GET /api/leads → leadStatus) are a
// verified enum (NEW/CONTACTED/QUALIFIED/LOST). Loan statuses
// (GET /api/loans → currentLoanStatus.status) are NOT yet confirmed — unknown
// values fall through to null in mapLosStatus, so the stage is left unchanged
// (non-destructive). TODO: add the real loan-status strings once confirmed.
export const ARIVE_STATUS_MAP: Record<string, string> = {
  // Lead statuses (verified):
  NEW: 'new_inquiry',
  CONTACTED: 'new_inquiry',
  QUALIFIED: 'pre_qual',
  LOST: 'lost',
};

// Phase 117 — BytePro uses numeric status codes. Mapped onto the REAL leads.stage
// values (closing→clear_to_close, funded→closed, denied→declined).
export const BYTEPRO_STATUS_MAP: Record<string, string> = {
  '1': 'pre_qual',
  '2': 'processing',
  '3': 'conditional_approval',
  '4': 'clear_to_close',
  '5': 'clear_to_close',
  '6': 'closed',
  '7': 'declined',
};

export function mapLosStatus(losType: string, status: string): string | null {
  const m =
    losType === 'lendingpad' ? LENDINGPAD_STATUS_MAP
    : losType === 'arive' ? ARIVE_STATUS_MAP
    : losType === 'byte' ? BYTEPRO_STATUS_MAP
    : {};
  return m[status] ?? null;
}

// Ordering of the real stages, for the "LOS is system of record — IQ cannot move
// a LOS-linked loan backward" rule (enforced where IQ writes stage).
export const STAGE_ORDER = ['new_inquiry', 'pre_qual', 'application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close', 'closed'];
export function isBackward(from: string, to: string): boolean {
  const a = STAGE_ORDER.indexOf(from), b = STAGE_ORDER.indexOf(to);
  return a >= 0 && b >= 0 && b < a;
}
