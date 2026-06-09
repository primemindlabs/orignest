/**
 * Phase 43 — loan-type classification + display metadata. loan_type is free TEXT;
 * loan_category mirrors the leads.loan_category generated column.
 */
export type LoanCategory = 'residential' | 'non_agency' | 'commercial';

export interface LoanTypeMeta { category: LoanCategory; label: string; icon: string; description: string }

export const LOAN_TYPE_META: Record<string, LoanTypeMeta> = {
  conventional: { category: 'residential', label: 'Conventional', icon: '🏠', description: 'Standard Fannie/Freddie conforming loan' },
  fha: { category: 'residential', label: 'FHA', icon: '🏠', description: '3.5% down, flexible credit guidelines' },
  va: { category: 'residential', label: 'VA', icon: '🎖️', description: 'No down payment for veterans + active duty' },
  usda: { category: 'residential', label: 'USDA', icon: '🌾', description: 'Rural areas, 0% down for eligible borrowers' },
  jumbo: { category: 'residential', label: 'Jumbo', icon: '💎', description: 'Loan amounts above conforming limits' },
  dscr: { category: 'non_agency', label: 'DSCR', icon: '📊', description: 'Debt Service Coverage Ratio — qualify on rental income' },
  non_qm_bank_stmt: { category: 'non_agency', label: 'Bank Statement', icon: '🏦', description: 'Self-employed — qualify on 12/24 months deposits' },
  non_qm_1099: { category: 'non_agency', label: '1099 Income', icon: '📋', description: 'Independent contractors qualifying on 1099 income' },
  non_qm_asset_depletion: { category: 'non_agency', label: 'Asset Depletion', icon: '💰', description: 'Qualify on liquid assets — no income required' },
  non_qm_itin: { category: 'non_agency', label: 'ITIN', icon: '🌎', description: 'Non-US citizens qualifying with ITIN' },
  commercial_multifamily: { category: 'commercial', label: 'Multifamily (5+)', icon: '🏢', description: '5+ unit residential investment property' },
  commercial_office: { category: 'commercial', label: 'Office', icon: '🏢', description: 'Office building or campus' },
  commercial_retail: { category: 'commercial', label: 'Retail', icon: '🏪', description: 'Retail strip, shopping center, single-tenant' },
  commercial_industrial: { category: 'commercial', label: 'Industrial', icon: '🏭', description: 'Warehouse, flex, industrial park' },
  commercial_mixed_use: { category: 'commercial', label: 'Mixed Use', icon: '🏘️', description: 'Residential + commercial combination' },
  commercial_bridge: { category: 'commercial', label: 'Bridge Loan', icon: '🌉', description: 'Short-term financing, typically 6–36 months' },
  commercial_permanent: { category: 'commercial', label: 'Perm Commercial', icon: '🏗️', description: 'Long-term commercial mortgage' },
};

export const CATEGORY_LABEL: Record<LoanCategory, string> = { residential: 'Residential', non_agency: 'Non-Agency', commercial: 'Commercial' };
export const CATEGORY_COLOR: Record<LoanCategory, string> = { residential: '#4A90D9', non_agency: '#7B68EE', commercial: '#E67E22' };

export function classifyLoanType(loanType: string | null | undefined): LoanCategory {
  if (!loanType) return 'residential';
  return LOAN_TYPE_META[loanType]?.category ?? 'residential';
}

/** Grouped options for the "create loan" type selector. */
export const LOAN_TYPE_GROUPS: { category: LoanCategory; types: string[] }[] = [
  { category: 'residential', types: ['conventional', 'fha', 'va', 'usda', 'jumbo'] },
  { category: 'non_agency', types: ['dscr', 'non_qm_bank_stmt', 'non_qm_1099', 'non_qm_asset_depletion', 'non_qm_itin'] },
  { category: 'commercial', types: ['commercial_multifamily', 'commercial_office', 'commercial_retail', 'commercial_industrial', 'commercial_mixed_use', 'commercial_bridge', 'commercial_permanent'] },
];
