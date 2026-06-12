// Phase 91 — PURE comp/BPS take-home math. No I/O.
//
// Reg Z 1026.36 (LO Compensation Rule): an LO's compensation may not vary based on a
// loan's terms or a proxy for them. So comp basis is limited to BPS on loan amount or a
// flat fee per loan — there is intentionally NO "percent of lender credit" basis.
// branch_split_pct and processor_fee are deductions from take-home, not the comp basis.

export type CompType = 'bps' | 'flat_fee';

export interface CompInputs {
  loanAmount: number;
  compType: CompType;
  bpsRate?: number | null;        // basis points; 100 = 1.00%
  flatFee?: number | null;
  branchSplitPct?: number | null; // % of gross that goes to the branch
  processorFee?: number | null;   // flat deduction per loan
}

export interface CompResult {
  grossComp: number;
  branchSplitAmount: number;
  processorDeduction: number;
  netComp: number;
  effectiveBps: number;           // gross as bps of loan amount
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeComp(inputs: CompInputs): CompResult {
  const loanAmount = Number(inputs.loanAmount) || 0;

  let grossComp = 0;
  if (inputs.compType === 'flat_fee') {
    grossComp = Number(inputs.flatFee) || 0;
  } else {
    grossComp = loanAmount * ((Number(inputs.bpsRate) || 0) / 10_000);
  }

  const branchSplitAmount = grossComp * ((Number(inputs.branchSplitPct) || 0) / 100);
  const processorDeduction = Number(inputs.processorFee) || 0;
  const netComp = grossComp - branchSplitAmount - processorDeduction;

  return {
    grossComp: r2(grossComp),
    branchSplitAmount: r2(branchSplitAmount),
    processorDeduction: r2(processorDeduction),
    netComp: r2(netComp),
    effectiveBps: loanAmount > 0 ? r2((grossComp / loanAmount) * 10_000) : 0,
  };
}
