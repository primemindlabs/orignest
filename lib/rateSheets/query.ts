// Phase 114 — rate-sheet pricing math. PURE.
// Applies the LLPAs that match a borrower's FICO/LTV/purpose to a product's base price.
// Price points: 100.000 = par; higher adjusted price = less cost to the borrower.

export interface Llpa {
  adjuster_name: string;
  fico_min: number | null;
  fico_max: number | null;
  ltv_min: number | null;
  ltv_max: number | null;
  loan_purpose: string | null;
  adjustment: number;
}

export interface BorrowerProfile {
  fico: number;
  ltv: number;
  loan_purpose?: string | null;
}

export function llpaApplies(l: Llpa, p: BorrowerProfile): boolean {
  // A null bound = unconstrained on that axis.
  if (l.fico_min != null && p.fico < l.fico_min) return false;
  if (l.fico_max != null && p.fico > l.fico_max) return false;
  if (l.ltv_min != null && p.ltv < l.ltv_min) return false;
  if (l.ltv_max != null && p.ltv > l.ltv_max) return false;
  if (l.loan_purpose && p.loan_purpose && l.loan_purpose !== p.loan_purpose) return false;
  return true;
}

export interface PriceResult {
  base_price: number;
  total_llpa: number;
  adjusted_price: number;
  applied: { adjuster_name: string; adjustment: number }[];
}

export function applyLlpas(basePrice: number | null, llpas: Llpa[], p: BorrowerProfile): PriceResult {
  const base = basePrice ?? 100;
  const applied = llpas.filter((l) => llpaApplies(l, p)).map((l) => ({ adjuster_name: l.adjuster_name, adjustment: Number(l.adjustment) }));
  const total = Math.round(applied.reduce((s, a) => s + a.adjustment, 0) * 1000) / 1000;
  return {
    base_price: base,
    total_llpa: total,
    adjusted_price: Math.round((base + total) * 1000) / 1000,
    applied,
  };
}
