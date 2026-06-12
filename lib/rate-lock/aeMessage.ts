// Phase 104 — pre-drafted AE extension request. PURE.
// Borrower privacy: callers pass "first name + last initial" only — never a full
// last name in AE communication text.

export function draftAEMessage(params: {
  lockRef: string | null; // lock reference number or null
  borrowerName: string; // "first name + last initial" only (e.g. "Maria G.")
  daysNeeded: number;
  closingTarget: string | null; // ISO date or null
  currentStage: string;
}): string {
  const lockRefPart = params.lockRef ? `lock ref ${params.lockRef}` : 'the rate lock on this file';
  const stage = (params.currentStage ?? '').replace(/_/g, ' ').trim() || 'process';
  const closingPart = params.closingTarget
    ? `Closing target ${new Date(params.closingTarget).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`
    : '';

  return `Hi [AE Name], I need a ${params.daysNeeded}-day extension on ${lockRefPart} for the ${params.borrowerName} file. File is currently in ${stage}. ${closingPart} Can you confirm extension cost and process ASAP? Thank you.`
    .replace(/\s+/g, ' ')
    .trim();
}
