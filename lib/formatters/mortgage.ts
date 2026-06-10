/**
 * Phase 73 — mortgage enum → human label formatters. PURE, display-layer only.
 * Fixes raw underscore_case renders like "rate_term_refinance" → "Rate/Term Refinance".
 */
export const LOAN_PURPOSE_LABELS: Record<string, string> = {
  purchase: 'Purchase',
  rate_term_refinance: 'Rate/Term Refinance',
  cash_out_refinance: 'Cash-Out Refinance',
  streamline_refinance: 'Streamline Refinance',
  construction: 'Construction',
  construction_to_perm: 'Construction-to-Perm',
  bridge: 'Bridge Loan',
  heloc: 'HELOC',
  reverse: 'Reverse Mortgage',
  home_equity: 'Home Equity Loan',
};

export const LOAN_TYPE_LABELS: Record<string, string> = {
  conventional: 'Conventional',
  fha: 'FHA',
  va: 'VA',
  usda: 'USDA',
  jumbo: 'Jumbo',
  non_qm: 'Non-QM',
  dscr: 'DSCR',
  commercial: 'Commercial',
  bridge: 'Bridge',
  construction: 'Construction',
  reverse: 'Reverse',
};

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  single_family: 'Single Family',
  multi_family: 'Multi-Family (2–4 units)',
  condo: 'Condominium',
  townhouse: 'Townhouse',
  manufactured: 'Manufactured Home',
  commercial: 'Commercial',
  land: 'Land',
  mixed_use: 'Mixed Use',
};

export const OCCUPANCY_LABELS: Record<string, string> = {
  primary: 'Primary Residence',
  second_home: 'Second Home',
  investment: 'Investment Property',
  owner_occupied: 'Owner Occupied',
  non_owner: 'Non-Owner Occupied',
};

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  google: 'Google',
  zillow: 'Zillow',
  referral: 'Referral',
  direct: 'Direct',
  text_to_apply: 'Text-to-Apply',
  realtor: 'Realtor Referral',
  partner: 'Partner',
  open_house: 'Open House',
  website: 'Website',
};

/** Falls back to title-casing the raw value. Never shows raw underscore_case. */
export function formatMortgageEnum(
  value: string | null | undefined,
  labels: Record<string, string>,
): string | null {
  if (!value) return null;
  return labels[value] ?? value.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
