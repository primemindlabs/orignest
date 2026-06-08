/**
 * Home-equity & cash-out calculations — pure, framework-agnostic.
 *
 * Equity tracking complements the rate-driven refi-watch feature: it surfaces
 * borrowers whose home value has outrun their loan balance, scoring them for a
 * cash-out refinance or HELOC opportunity.
 */

export interface EquityInput {
  estimatedValue: number;      // current home value
  loanBalance: number;         // current principal balance (or best estimate)
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const round0 = (n: number) => Math.round(n);

/** Owner's equity = value − balance (never below 0 for display). */
export function equity(input: EquityInput): number {
  return round0(Math.max(0, input.estimatedValue - input.loanBalance));
}

/** Current loan-to-value as a percentage (0–100+). */
export function currentLtv(input: EquityInput): number {
  if (input.estimatedValue <= 0) return 0;
  return round2((input.loanBalance / input.estimatedValue) * 100);
}

/**
 * Cash a borrower could pull out via a cash-out refinance, capped at a max LTV
 * (conventional cash-out tops out at 80%). Returns 0 if already above the cap.
 */
export function availableCashOut(input: EquityInput, maxLtvPct = 80): number {
  const maxLoan = input.estimatedValue * (maxLtvPct / 100);
  return round0(Math.max(0, maxLoan - input.loanBalance));
}

export type EquityTier = 'high' | 'moderate' | 'low' | 'underwater';

/**
 * Opportunity score 0–100 for a cash-out / HELOC pitch: rewards high equity %
 * and meaningful available cash-out. Used to rank a book of closed borrowers.
 */
export function equityOpportunityScore(input: EquityInput, maxLtvPct = 80): { score: number; tier: EquityTier } {
  const eq = equity(input);
  const value = input.estimatedValue;
  if (value <= 0) return { score: 0, tier: 'low' };
  const equityPct = eq / value;
  const cashOut = availableCashOut(input, maxLtvPct);

  if (input.loanBalance > value) return { score: 0, tier: 'underwater' };

  // 60% weight on equity share, 40% on absolute cash-out (saturating at $200k).
  const equityComponent = Math.min(1, equityPct / 0.6) * 60;
  const cashComponent = Math.min(1, cashOut / 200_000) * 40;
  const score = Math.round(equityComponent + cashComponent);

  const tier: EquityTier = equityPct >= 0.4 ? 'high' : equityPct >= 0.2 ? 'moderate' : 'low';
  return { score, tier };
}

/** Aggregate equity report across a book of closed loans. */
export interface EquityPosition extends EquityInput {
  id: string;
  name: string;
  cashOut: number;
  ltv: number;
  equity: number;
  score: number;
  tier: EquityTier;
}

export function buildPositions(
  rows: Array<{ id: string; name: string; estimatedValue: number; loanBalance: number }>,
  maxLtvPct = 80,
): { positions: EquityPosition[]; totals: { count: number; totalEquity: number; totalCashOut: number; avgLtv: number; highTier: number } } {
  const positions: EquityPosition[] = rows
    .map((r) => {
      const input = { estimatedValue: r.estimatedValue, loanBalance: r.loanBalance };
      const { score, tier } = equityOpportunityScore(input, maxLtvPct);
      return {
        ...input,
        id: r.id,
        name: r.name,
        equity: equity(input),
        ltv: currentLtv(input),
        cashOut: availableCashOut(input, maxLtvPct),
        score,
        tier,
      };
    })
    .sort((a, b) => b.score - a.score);

  const count = positions.length;
  const totalEquity = positions.reduce((s, p) => s + p.equity, 0);
  const totalCashOut = positions.reduce((s, p) => s + p.cashOut, 0);
  const avgLtv = count ? round2(positions.reduce((s, p) => s + p.ltv, 0) / count) : 0;
  const highTier = positions.filter((p) => p.tier === 'high').length;

  return { positions, totals: { count, totalEquity, totalCashOut, avgLtv, highTier } };
}
