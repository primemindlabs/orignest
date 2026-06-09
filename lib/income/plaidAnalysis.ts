/**
 * Phase 56.3 — bank-statement income analysis from Plaid/Finicity transactions.
 * PURE. Runs IN MEMORY only — raw transactions are NEVER persisted; only the
 * processed result is stored, then the access token is revoked (see route).
 */
export interface PlaidTxn { amount: number; date: string }
export interface PlaidIncomeResult {
  months_analyzed: number;
  average_monthly_deposits: number;
  qualifying_income: number;
  notes: string;
}

/** Plaid convention: negative amount = money IN (deposit). depositFactor 0.50
 * personal / 0.75 business per typical bank-statement program. */
export function analyzeTransactionsForIncome(transactions: PlaidTxn[], depositFactor = 0.5): PlaidIncomeResult {
  const deposits = transactions.filter((t) => t.amount < 0);
  const byMonth = new Map<string, number>();
  for (const t of deposits) {
    const m = (t.date ?? '').slice(0, 7); // yyyy-MM
    if (m) byMonth.set(m, (byMonth.get(m) ?? 0) + Math.abs(t.amount));
  }
  const months = byMonth.size || 1;
  const avg = Array.from(byMonth.values()).reduce((s, v) => s + v, 0) / months;
  const qualifying = avg * depositFactor;
  return {
    months_analyzed: byMonth.size,
    average_monthly_deposits: Math.round(avg * 100) / 100,
    qualifying_income: Math.round(qualifying * 100) / 100,
    notes: `${byMonth.size}-month analysis via bank connection. Avg deposits ${avg.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}/mo. ${(depositFactor * 100).toFixed(0)}% factor applied. Raw transactions discarded after processing.`,
  };
}
