/**
 * Phase 56.2 — Encompass (ICE Mortgage Technology) field-ID map + milestone
 * mapping. PURE. Encompass uses numeric field IDs; this maps our schema to theirs
 * and normalizes Encompass milestones to the canonical leads.stage values.
 */
export const ENCOMPASS_FIELD_MAP: Record<string, string> = {
  borrower_first_name: '4000', borrower_last_name: '4002', borrower_email: '1240', borrower_phone: '1715',
  loan_amount: '1109', property_address: '11', property_city: '12', property_state: '14', property_zip: '15',
  property_value: '356', loan_purpose: '19', loan_type: '1172', interest_rate: '3', lock_expiration_date: '762',
  application_date: '745', closing_date: '748', loan_status: 'Log.MS.CurrentMilestone', lo_name: '317', lo_nmls: '1612',
};

/** Encompass milestone → canonical leads.stage (load-bearing CHECK values). */
export function mapEncompassMilestone(milestone: string | null | undefined): string {
  const m = (milestone ?? '').toLowerCase();
  if (m.includes('completion') || m.includes('funded') || m.includes('shipping')) return 'closed';
  if (m.includes('clear to close') || m.includes('ctc') || m.includes('doc')) return 'clear_to_close';
  if (m.includes('approval') || m.includes('conditional')) return 'conditional_approval';
  if (m.includes('underwriting') || m.includes('submittal')) return 'underwriting';
  if (m.includes('processing') || m.includes('setup')) return 'processing';
  if (m.includes('application') || m.includes('started') || m.includes('qualification')) return 'application';
  return 'application';
}

export function mapEncompassLoanType(lienOrType: string | null | undefined): string {
  const t = (lienOrType ?? '').toLowerCase();
  if (t.includes('fha')) return 'fha';
  if (t.includes('va')) return 'va';
  if (t.includes('usda')) return 'usda';
  if (t.includes('jumbo')) return 'jumbo';
  return 'conventional';
}
