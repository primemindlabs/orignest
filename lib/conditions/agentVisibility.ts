/**
 * Phase 55.3 — default agent visibility for a loan condition.
 * Income / credit / asset / identity conditions are HIDDEN from agents by default;
 * appraisal / title / insurance / closing logistics are shown. Anything
 * uncategorized defaults to hidden (fail-closed).
 */
const AGENT_VISIBLE = new Set(['appraisal', 'title', 'insurance', 'closing', 'inspection', 'survey', 'hoa', 'property']);
const AGENT_HIDDEN = new Set(['income', 'employment', 'credit', 'assets', 'liabilities', 'identity', 'compliance']);

export function getDefaultAgentVisibility(category: string | null | undefined): boolean {
  const c = (category ?? '').toLowerCase();
  if (AGENT_HIDDEN.has(c)) return false;
  return AGENT_VISIBLE.has(c); // uncategorized → false (fail-closed)
}
