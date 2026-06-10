/**
 * Phase 75 — Dashboard persona resolution.
 *
 * Roles map to a *persona* (which widgets show) and a *scope* (whose loans the
 * numbers reflect):
 *
 *  - leadership  → org-wide rollup, full financial layout (volume / commission / goal)
 *  - producer    → personal book (leads.assigned_to = me), full financial layout
 *  - operations  → personal queue, work-focused layout (no commission / no goal ring)
 *
 * Role strings are free TEXT in `profiles.role` (no enum), so we normalize defensively.
 */

export type DashboardPersona = 'producer' | 'operations' | 'leadership';
export type DashboardScopeLevel = 'org' | 'personal';

const LEADERSHIP_ROLES = new Set(['branch_manager', 'manager', 'admin', 'owner', 'broker']);
const OPERATIONS_ROLES = new Set(['processor', 'loa', 'underwriter', 'uw']);
// producers (default): loan_officer, lo, ae, account_executive — and anything unknown

export function resolveDashboardPersona(role: string | null | undefined): {
  persona: DashboardPersona;
  scope: DashboardScopeLevel;
} {
  const r = (role ?? '').toLowerCase().trim();

  if (LEADERSHIP_ROLES.has(r)) return { persona: 'leadership', scope: 'org' };
  if (OPERATIONS_ROLES.has(r)) return { persona: 'operations', scope: 'personal' };
  return { persona: 'producer', scope: 'personal' };
}
