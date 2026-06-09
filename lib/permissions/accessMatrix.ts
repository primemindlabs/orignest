/**
 * Phase 31.3 — Role-based access matrix.
 *
 * Enforced at the app/data-access layer (the app reads via the service-role
 * admin client, so Postgres RLS role-checks don't apply). scopeLeadQuery()
 * applies the per-role lead visibility; ROLE_PERMISSIONS gates UI capabilities.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'lo' | 'loan_officer' | 'loa' | 'processor' | 'branch_manager' | 'compliance_officer';

export interface RolePermissions {
  see_all_loans_in_tenant: boolean;
  see_other_lo_loans: boolean;
  see_financial_data: boolean;
  send_disclosures: boolean;
  access_compliance: boolean;
  manage_team: boolean;
}

export const ROLE_PERMISSIONS: Record<string, RolePermissions> = {
  admin:              { see_all_loans_in_tenant: true,  see_other_lo_loans: true,  see_financial_data: true,  send_disclosures: true,  access_compliance: true,  manage_team: true },
  lo:                 { see_all_loans_in_tenant: false, see_other_lo_loans: false, see_financial_data: true,  send_disclosures: true,  access_compliance: true,  manage_team: false },
  loan_officer:       { see_all_loans_in_tenant: false, see_other_lo_loans: false, see_financial_data: true,  send_disclosures: true,  access_compliance: true,  manage_team: false },
  loa:                { see_all_loans_in_tenant: false, see_other_lo_loans: false, see_financial_data: true,  send_disclosures: false, access_compliance: false, manage_team: false },
  processor:          { see_all_loans_in_tenant: false, see_other_lo_loans: false, see_financial_data: true,  send_disclosures: false, access_compliance: false, manage_team: false },
  branch_manager:     { see_all_loans_in_tenant: true,  see_other_lo_loans: true,  see_financial_data: true,  send_disclosures: false, access_compliance: true,  manage_team: true },
  compliance_officer: { see_all_loans_in_tenant: true,  see_other_lo_loans: true,  see_financial_data: false, send_disclosures: false, access_compliance: true,  manage_team: false },
};

export function permissionsFor(role: string | null | undefined): RolePermissions {
  return ROLE_PERMISSIONS[role ?? 'lo'] ?? ROLE_PERMISSIONS.lo;
}

/** Title agent (token-gated portal — no Clerk account). NEVER any financial data. */
export const TITLE_AGENT_PERMISSIONS = {
  see_closing_disclosure: true,
  see_wire_instructions: true,
  see_closing_checklist: true,
  see_chat: true,
  see_application_data: false,
  see_income_data: false,
  see_credit_data: false,
  see_rate_pricing: false,
} as const;

/**
 * Returns the set of lead IDs a (role, profileId) may see in this org, or `null`
 * meaning "no restriction beyond org" (LO sees own; admin/BM/compliance see all).
 * Pages should: if scope is an array, `.in('id', scope)`; the LO case also adds
 * `.eq('assigned_to', profileId)`.
 */
export async function scopeLeadIds(
  sb: SupabaseClient<any, any, any>,
  orgId: string,
  role: string,
  profileId: string
): Promise<{ leadIds: string[] | null; assignedToSelf: boolean }> {
  const perms = permissionsFor(role);
  if (perms.see_all_loans_in_tenant) return { leadIds: null, assignedToSelf: false };

  if (role === 'loa') {
    // Loans of the LOs this assistant is assigned to.
    const { data: assigns } = await sb.from('portal_loa_assignments').select('lo_user_id').eq('org_id', orgId).eq('loa_user_id', profileId);
    const loIds = (assigns ?? []).map((a) => a.lo_user_id);
    if (loIds.length === 0) return { leadIds: [], assignedToSelf: false };
    const { data: leads } = await sb.from('leads').select('id').eq('org_id', orgId).in('assigned_to', loIds);
    return { leadIds: (leads ?? []).map((l) => l.id), assignedToSelf: false };
  }

  if (role === 'processor') {
    const { data: pa } = await sb.from('portal_processor_assignments').select('assigned_lead_ids').eq('org_id', orgId).eq('processor_id', profileId).maybeSingle();
    return { leadIds: (pa?.assigned_lead_ids as string[] | undefined) ?? [], assignedToSelf: false };
  }

  // LO (default): only their own assigned loans.
  return { leadIds: null, assignedToSelf: true };
}
