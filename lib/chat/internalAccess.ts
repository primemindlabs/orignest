// Phase 109 — who can see a loan's INTERNAL chat ("watchers"), DERIVED from existing
// data instead of a watchers table:
//   - branch managers / admins      → all loans in the org
//   - the assigned LO               → leads.assigned_to
//   - assigned processors           → loan_processor_assignments (active)
//   - LOAs assigned to that LO       → user_roles.assigned_lo_id (active)
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

type Admin = SupabaseClient<any, any, any>;

export interface InternalChatActor {
  profileId: string;
  role: string; // resolved app role (admin/branch_manager/lo/loa/processor)
}

export async function canAccessInternalChat(
  sb: Admin,
  orgId: string,
  leadId: string,
  actor: InternalChatActor
): Promise<boolean> {
  // Org-wide visibility for managers/admins.
  if (actor.role === 'admin' || actor.role === 'branch_manager') return true;

  const { data: lead } = await sb
    .from('leads')
    .select('assigned_to')
    .eq('id', leadId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) return false;

  const assignedLo = (lead.assigned_to as string | null) ?? null;

  // The assigned LO.
  if (assignedLo && assignedLo === actor.profileId) return true;

  // LOA assigned to this loan's LO.
  if (actor.role === 'loa' && assignedLo) {
    const { data: roleRow } = await sb
      .from('user_roles')
      .select('assigned_lo_id')
      .eq('org_id', orgId)
      .eq('user_id', actor.profileId)
      .eq('role', 'loa')
      .eq('is_active', true)
      .maybeSingle();
    if (roleRow?.assigned_lo_id && roleRow.assigned_lo_id === assignedLo) return true;
  }

  // Assigned processor.
  const { data: proc } = await sb
    .from('loan_processor_assignments')
    .select('id')
    .eq('org_id', orgId)
    .eq('loan_id', leadId)
    .eq('processor_id', actor.profileId)
    .eq('is_active', true)
    .maybeSingle();
  if (proc) return true;

  return false;
}
