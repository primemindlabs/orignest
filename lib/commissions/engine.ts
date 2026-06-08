/**
 * Commission engine — pure, side-effect-free calculation logic.
 *
 * COMPLIANCE — Reg Z 1026.36(d)(1): loan-originator compensation may not be
 * based on the terms of the transaction. Every function here keys comp off the
 * loan AMOUNT only (a bps figure or a flat per-loan dollar amount). There is no
 * code path that lets rate, points, or product influence the computed comp.
 *
 * Kept free of Supabase/Next imports so it is trivially unit-testable and
 * reusable from API routes, projections, and exports alike.
 */

export type CompBasis = 'bps' | 'flat';

export interface CompPlan {
  id: string;
  lo_id: string | null;
  name: string;
  basis: CompBasis;
  comp_bps: number | null;
  comp_flat: number | null;
  min_loan_amount: number;
  max_loan_amount: number | null;
  max_comp_amount: number | null;
  effective_date: string;
  is_active: boolean;
}

export interface CommissionSplit {
  profile_id: string;
  role: 'originator' | 'co_originator' | 'team_lead' | 'assistant';
  split_pct: number;
}

export interface ManagerOverride {
  manager_profile_id: string;
  override_bps: number | null;
  override_flat: number | null;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Compute gross commission for a closed loan from a plan. Loan-amount-only:
 *   bps  → loanAmount * (comp_bps / 10_000)
 *   flat → comp_flat
 * Applies an optional per-loan dollar cap. Never negative.
 */
export function computeCommission(loanAmount: number, plan: Pick<CompPlan, 'basis' | 'comp_bps' | 'comp_flat' | 'max_comp_amount'>): number {
  if (!Number.isFinite(loanAmount) || loanAmount <= 0) return 0;

  let gross: number;
  if (plan.basis === 'bps') {
    gross = loanAmount * ((plan.comp_bps ?? 0) / 10_000);
  } else {
    gross = plan.comp_flat ?? 0;
  }

  if (plan.max_comp_amount != null && gross > plan.max_comp_amount) {
    gross = plan.max_comp_amount;
  }
  return round2(Math.max(0, gross));
}

/**
 * Pick the plan that applies to a loan: prefer a plan assigned to the LO over
 * an org-wide default, require the loan amount to fall in the plan's band, and
 * among ties take the most recent effective_date. Returns null if none match.
 */
export function selectPlan(
  plans: CompPlan[],
  opts: { loanAmount: number; loId: string | null },
): CompPlan | null {
  const candidates = plans.filter(
    (p) =>
      p.is_active &&
      opts.loanAmount >= p.min_loan_amount &&
      (p.max_loan_amount == null || opts.loanAmount <= p.max_loan_amount) &&
      (p.lo_id == null || p.lo_id === opts.loId),
  );
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    // LO-specific beats org default.
    const aLo = a.lo_id ? 1 : 0;
    const bLo = b.lo_id ? 1 : 0;
    if (aLo !== bLo) return bLo - aLo;
    // Then most recent effective_date.
    return b.effective_date.localeCompare(a.effective_date);
  });
  return candidates[0];
}

/** Compute an override amount (loan-amount-keyed: bps or flat). */
export function computeOverride(loanAmount: number, override: ManagerOverride): number {
  if (!Number.isFinite(loanAmount) || loanAmount <= 0) return 0;
  const amt =
    override.override_bps != null
      ? loanAmount * (override.override_bps / 10_000)
      : override.override_flat ?? 0;
  return round2(Math.max(0, amt));
}

/**
 * Allocate a gross commission across split participants by percentage.
 * Returns each split's dollar amount plus the unallocated remainder (which
 * stays with the primary originator). Caller should reject sums over 100%.
 */
export function computeSplits(
  gross: number,
  splits: CommissionSplit[],
): { allocations: Array<CommissionSplit & { split_amount: number }>; totalPct: number; remainder: number } {
  const totalPct = round2(splits.reduce((s, x) => s + (x.split_pct || 0), 0));
  const allocations = splits.map((s) => ({
    ...s,
    split_amount: round2(gross * (s.split_pct / 100)),
  }));
  const allocated = round2(allocations.reduce((s, a) => s + a.split_amount, 0));
  return { allocations, totalPct, remainder: round2(gross - allocated) };
}

/** Net take-home for the primary LO after splits and referral fees are removed. */
export function netToLO(gross: number, splits: CommissionSplit[], referralFee = 0): number {
  const { allocations } = computeSplits(gross, splits);
  const splitOut = allocations
    .filter((a) => a.role !== 'originator')
    .reduce((s, a) => s + a.split_amount, 0);
  return round2(Math.max(0, gross - splitOut - (referralFee || 0)));
}

/**
 * Stage → probability-of-closing, used to risk-weight pipeline projections.
 * Stages match the leads CHECK constraint in 20260531_conduit_v2_schema.sql.
 */
export const STAGE_CLOSE_PROBABILITY: Record<string, number> = {
  new_inquiry: 0.05,
  pre_qual: 0.15,
  application: 0.35,
  processing: 0.55,
  underwriting: 0.7,
  conditional_approval: 0.85,
  clear_to_close: 0.97,
  closed: 1,
  declined: 0,
  withdrawn: 0,
};

export interface PipelineLead {
  id: string;
  loan_amount: number | null;
  stage: string;
  lo_id?: string | null;
}

export interface ProjectionResult {
  expectedComp: number;   // probability-weighted
  potentialComp: number;  // if every open loan closed
  loanCount: number;
  byStage: Record<string, { count: number; expectedComp: number; potentialComp: number }>;
}

/**
 * Project future commission from the open pipeline: for each lead pick the
 * applicable plan, compute potential comp, and weight by stage probability.
 */
export function projectPipeline(leads: PipelineLead[], plans: CompPlan[]): ProjectionResult {
  const result: ProjectionResult = {
    expectedComp: 0,
    potentialComp: 0,
    loanCount: 0,
    byStage: {},
  };

  for (const lead of leads) {
    const amount = lead.loan_amount ?? 0;
    const prob = STAGE_CLOSE_PROBABILITY[lead.stage] ?? 0;
    if (amount <= 0 || prob === 0) continue;

    const plan = selectPlan(plans, { loanAmount: amount, loId: lead.lo_id ?? null });
    if (!plan) continue;

    const potential = computeCommission(amount, plan);
    const expected = round2(potential * prob);

    result.loanCount += 1;
    result.potentialComp = round2(result.potentialComp + potential);
    result.expectedComp = round2(result.expectedComp + expected);

    const bucket = (result.byStage[lead.stage] ??= { count: 0, expectedComp: 0, potentialComp: 0 });
    bucket.count += 1;
    bucket.potentialComp = round2(bucket.potentialComp + potential);
    bucket.expectedComp = round2(bucket.expectedComp + expected);
  }

  return result;
}
