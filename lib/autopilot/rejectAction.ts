/** Phase 128 — reject a recommended action (with optional LO feedback). */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function rejectAction(
  sb: SupabaseClient,
  actionId: string,
  loId: string,
  reason?: string,
): Promise<void> {
  const { data: action } = await sb
    .from('autopilot_actions')
    .select('org_id, status')
    .eq('id', actionId)
    .eq('lo_id', loId)
    .maybeSingle();
  if (!action) throw new Error('Action not found');
  if (action.status !== 'pending') throw new Error('Only pending actions can be rejected');

  const { error } = await sb
    .from('autopilot_actions')
    .update({ status: 'rejected', rejected_at: new Date().toISOString(), rejection_reason: reason ?? null })
    .eq('id', actionId)
    .eq('lo_id', loId)
    .eq('status', 'pending');
  if (error) throw error;

  await sb.from('autopilot_audit_log').insert({
    org_id: action.org_id as string,
    lo_id: loId,
    autopilot_action_id: actionId,
    event: 'rejected',
    event_metadata: reason ? { rejection_reason: reason } : {},
  });
}
