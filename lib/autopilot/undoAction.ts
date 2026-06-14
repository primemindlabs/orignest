/** Phase 128 — undo an approved action within the 5-minute window. Because the
 * executor cron only sends actions whose status is still 'approved' AND whose
 * undo_deadline has passed, flipping status to 'undone' here is sufficient to
 * cancel the pending send — there is no separate scheduled job to unwind. */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function undoAction(sb: SupabaseClient, actionId: string, loId: string): Promise<void> {
  const { data: action } = await sb
    .from('autopilot_actions')
    .select('org_id, status, undo_deadline')
    .eq('id', actionId)
    .eq('lo_id', loId)
    .maybeSingle();
  if (!action) throw new Error('Action not found');
  if (action.status !== 'approved') {
    throw new Error('Action cannot be undone — already executed or not approved.');
  }
  if (action.undo_deadline && new Date() > new Date(action.undo_deadline as string)) {
    throw new Error('Undo window has passed (5 minutes).');
  }

  const { error } = await sb
    .from('autopilot_actions')
    .update({ status: 'undone', undo_used_at: new Date().toISOString() })
    .eq('id', actionId)
    .eq('lo_id', loId)
    .eq('status', 'approved');
  if (error) throw error;

  await sb.from('autopilot_audit_log').insert({
    org_id: action.org_id as string,
    lo_id: loId,
    autopilot_action_id: actionId,
    event: 'undo_completed',
  });
}
