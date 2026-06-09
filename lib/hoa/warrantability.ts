/**
 * Phase 64.2 — Fannie/Freddie condo & PUD warrantability. PURE.
 * Hard disqualifiers (FNMA B4-2) vs conditional factors vs passed. Non-warrantable
 * results suggest fallback loan options.
 */
export interface HoaInput {
  project_type?: 'condo' | 'pud' | 'co_op';
  total_units?: number; owner_occupancy_pct?: number; single_investor_pct?: number; commercial_space_pct?: number;
  reserve_pct_of_budget?: number; delinquency_pct_30_plus?: number;
  pending_special_assessment?: boolean; special_assessment_amount?: number;
  hazard_insurance_adequate?: boolean; flood_insurance_required?: boolean; flood_insurance_obtained?: boolean; fidelity_bond_obtained?: boolean;
  pending_litigation?: boolean; litigation_insurance_covered?: boolean; construction_defect_litigation?: boolean;
  physical_deficiencies?: boolean; deficiency_description?: string;
}
export interface WarrantabilityResult { status: 'warrantable' | 'non_warrantable' | 'conditional' | 'review_needed'; disqualifying_factors: string[]; conditional_factors: string[]; passed_criteria: string[]; lender_options: string[] }

const n = (v: unknown) => Number(v ?? 0);

export function assessWarrantability(q: HoaInput): WarrantabilityResult {
  const dq: string[] = []; const cond: string[] = []; const passed: string[] = [];

  if (n(q.delinquency_pct_30_plus) > 15) dq.push(`HOA dues delinquency ${n(q.delinquency_pct_30_plus)}% (max 15%)`); else passed.push(`Delinquency ${n(q.delinquency_pct_30_plus)}% ≤ 15%`);
  if (n(q.single_investor_pct) > 10) dq.push(`Single entity owns ${n(q.single_investor_pct)}% of units (max 10%)`); else passed.push('No single investor > 10%');
  if (n(q.commercial_space_pct) > 25) dq.push(`Commercial space ${n(q.commercial_space_pct)}% (max 25%)`); else passed.push(`Commercial space ${n(q.commercial_space_pct)}% ≤ 25%`);

  if (q.pending_litigation && !q.litigation_insurance_covered) dq.push('Pending litigation not covered by insurance');
  else if (q.pending_litigation && q.litigation_insurance_covered) cond.push('Pending litigation — insured; underwriter review required');
  else passed.push('No pending litigation');
  if (q.construction_defect_litigation) dq.push('Active construction-defect litigation — project ineligible');

  if (q.hazard_insurance_adequate === false) dq.push('Hazard insurance inadequate or not in place'); else passed.push('Hazard insurance adequate');
  if (q.flood_insurance_required && !q.flood_insurance_obtained) dq.push('Flood insurance required but not in place');
  if (n(q.total_units) > 20 && !q.fidelity_bond_obtained) dq.push('Fidelity bond required (>20 units) — not in place');
  if (q.physical_deficiencies) dq.push(`Physical deficiencies: ${q.deficiency_description ?? 'noted'}`);

  if (n(q.reserve_pct_of_budget) < 10) cond.push(`Reserve allocation ${n(q.reserve_pct_of_budget)}% (min 10% — Fannie CPM waiver or alt doc)`); else passed.push(`Reserve funding ${n(q.reserve_pct_of_budget)}% ≥ 10%`);
  if (q.project_type === 'condo') { if (n(q.owner_occupancy_pct) < 50) cond.push(`Owner occupancy ${n(q.owner_occupancy_pct)}% (<50% — limited approval may apply)`); else passed.push(`Owner occupancy ${n(q.owner_occupancy_pct)}% ≥ 50%`); }
  if (q.pending_special_assessment && n(q.special_assessment_amount) > 5000) cond.push(`Special assessment pending $${n(q.special_assessment_amount).toLocaleString()} — may affect qualification`);

  const status: WarrantabilityResult['status'] = dq.length > 0 ? 'non_warrantable' : cond.length > 0 ? 'conditional' : 'warrantable';
  const lender_options = status === 'non_warrantable' ? ['Portfolio non-warrantable condo programs', 'Non-QM lenders with condo flexibility', 'Bank-statement programs accepting non-warrantable projects', 'Hard money (if investment / time-sensitive)'] : [];
  return { status, disqualifying_factors: dq, conditional_factors: cond, passed_criteria: passed, lender_options };
}
