/**
 * Phase 57.1 — role-based navigation registry.
 * Real profiles.role is free TEXT (no enum); normalizeRole maps the live values to
 * the canonical AppRole. Filtering is designed for ZERO regression: generalist
 * roles (lo / branch_manager / admin) keep the full existing nav; only the
 * specialized roles get a tailored, shorter view.
 */
export type AppRole =
  | 'lo' | 'loa' | 'processor' | 'underwriter'
  | 'brand_manager' | 'branch_manager' | 'ae' | 'ae_manager' | 'admin';

export function normalizeRole(role: string | null | undefined): AppRole {
  switch ((role ?? '').toLowerCase()) {
    case 'admin': return 'admin';
    case 'branch_manager': case 'manager': case 'owner': return 'branch_manager';
    case 'loa': case 'assistant': return 'loa';
    case 'processor': return 'processor';
    case 'underwriter': case 'uw': return 'underwriter';
    case 'brand_manager': case 'marketing': return 'brand_manager';
    case 'ae': return 'ae';
    case 'ae_manager': return 'ae_manager';
    default: return 'lo'; // loan_officer / lo / unknown
  }
}

/**
 * Allowed sidebar group keys per SPECIALIZED role. Roles absent here (lo,
 * branch_manager, admin) are "generalists" → see the full nav exactly as today.
 * Keys correspond to the NavGroup.key values in Sidebar.tsx.
 */
export const ROLE_GROUP_VISIBILITY: Partial<Record<AppRole, string[]>> = {
  loa: ['dashboard', 'pipeline', 'relationships', 'tools'],
  processor: ['dashboard', 'pipeline', 'tools'],
  underwriter: ['dashboard', 'pipeline', 'tools'],
  brand_manager: ['dashboard', 'marketing', 'analytics'],
  ae: ['dashboard', 'pipeline', 'relationships', 'analytics', 'management'],
  ae_manager: ['dashboard', 'relationships', 'analytics', 'management'],
};

/** Whether a nav group (by key + adminOnly flag) is visible to a role. */
export function isGroupVisible(groupKey: string, adminOnly: boolean | undefined, role: string | null | undefined): boolean {
  const norm = normalizeRole(role);
  if (norm === 'admin') return true;
  const allowed = ROLE_GROUP_VISIBILITY[norm];
  if (!allowed) return !adminOnly || norm === 'branch_manager'; // generalist → today's behavior
  return allowed.includes(groupKey); // specialized → explicit whitelist (bypasses adminOnly)
}

export const ROLE_LABELS: Record<AppRole, string> = {
  lo: 'Loan Officer', loa: 'LO Assistant', processor: 'Processor', underwriter: 'Underwriter',
  brand_manager: 'Brand Manager', branch_manager: 'Branch Manager', ae: 'Account Executive',
  ae_manager: 'AE Manager', admin: 'Administrator',
};
