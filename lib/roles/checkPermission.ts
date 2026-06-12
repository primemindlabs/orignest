/**
 * Phase 133 — pure role→permission map (per the spec's role definitions).
 * Used by both server (route guards) and client (RoleGate / feature toggles).
 */
import { normalizeRole, type AppRole } from '@/lib/navigation/roles';

export type Permission =
  | 'view_comp'              // comp calculator / BPS splits
  | 'view_business_pulse'    // branch-level BI
  | 'view_branch_reports'
  | 'access_ashley_brain'
  | 'approve_autopilot'
  | 'approve_drafts'         // approve LOA communication drafts
  | 'view_lender_sheets'
  | 'stage_loan'             // advance a loan's pipeline stage
  | 'view_realtor_financials'
  | 'manage_team'            // invite / assign roles
  | 'update_conditions'
  | 'upload_documents'
  | 'draft_communication';   // create a draft for LO review

const PERMISSIONS: Record<AppRole, Set<Permission>> = {
  admin: new Set<Permission>([
    'view_comp', 'view_business_pulse', 'view_branch_reports', 'access_ashley_brain', 'approve_autopilot',
    'approve_drafts', 'view_lender_sheets', 'stage_loan', 'view_realtor_financials', 'manage_team',
    'update_conditions', 'upload_documents', 'draft_communication',
  ]),
  branch_manager: new Set<Permission>([
    'view_business_pulse', 'view_branch_reports', 'access_ashley_brain', 'approve_autopilot', 'approve_drafts',
    'view_lender_sheets', 'stage_loan', 'view_realtor_financials', 'manage_team', 'update_conditions',
    'upload_documents', 'draft_communication',
  ]),
  lo: new Set<Permission>([
    'view_comp', 'access_ashley_brain', 'approve_autopilot', 'approve_drafts', 'view_lender_sheets',
    'stage_loan', 'view_realtor_financials', 'update_conditions', 'upload_documents', 'draft_communication',
  ]),
  loa: new Set<Permission>([
    // Can support the pipeline, but NO comp, NO autopilot approval, NO lender sheets,
    // NO staging. Drafts go to the LO for approval.
    'update_conditions', 'upload_documents', 'draft_communication',
  ]),
  processor: new Set<Permission>([
    // Only assigned loans: conditions + docs. No staging, no drafts approval, no brain.
    'update_conditions', 'upload_documents',
  ]),
  // Other live roles default to LO-like capability minus team management.
  underwriter: new Set<Permission>(['update_conditions', 'upload_documents', 'access_ashley_brain']),
  brand_manager: new Set<Permission>(['view_branch_reports']),
  ae: new Set<Permission>(['view_lender_sheets', 'draft_communication']),
  ae_manager: new Set<Permission>(['view_lender_sheets', 'view_branch_reports', 'manage_team']),
};

export function checkPermission(role: string | null | undefined, permission: Permission): boolean {
  return PERMISSIONS[normalizeRole(role)]?.has(permission) ?? false;
}
