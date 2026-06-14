/** Phase 128 — approve / approve-all. Approval opens a 5-minute undo window; the
 * executor cron performs the actual send only after that window passes. */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { UNDO_WINDOW_MS } from './types';

export async function approveAction(
  sb: SupabaseClient,
  actionId: string,
  loId: string,
): Promise<{ undoDeadline: string }> {
  const { data: action } = await sb
    .from('autopilot_actions')
    .select('org_id, status')
    .eq('id', actionId)
    .eq('lo_id', loId)
    .maybeSingle();
  if (!action) throw new Error('Action not found');
  if (action.status !== 'pending') throw new Error('Action is no longer pending');

  const nowIso = new Date().toISOString();
  const undoDeadline = new Date(Date.now() + UNDO_WINDOW_MS).toISOString();

  const { error } = await sb
    .from('autopilot_actions')
    .update({ status: 'approved', approved_at: nowIso, approved_by: loId, undo_deadline: undoDeadline })
    .eq('id', actionId)
    .eq('lo_id', loId)
    .eq('status', 'pending');
  if (error) throw error;

  await sb.from('autopilot_audit_log').insert({
    org_id: action.org_id as string,
    lo_id: loId,
    autopilot_action_id: actionId,
    event: 'approved',
  });

  return { undoDeadline };
}

export async function approveAllPending(
  sb: SupabaseClient,
  loId: string,
  generatedDate: string,
): Promise<{ count: number; undoDeadline: string }> {
  const { data: pending } = await sb
    .from('autopilot_actions')
    .select('id, org_id')
    .eq('lo_id', loId)
    .eq('generated_date', generatedDate)
    .eq('status', 'pending');

  const rows = (pending ?? []) as { id: string; org_id: string }[];
  if (!rows.length) return { count: 0, undoDeadline: new Date().toISOString() };

  const nowIso = new Date().toISOString();
  const undoDeadline = new Date(Date.now() + UNDO_WINDOW_MS).toISOString();

  const { error } = await sb
    .from('autopilot_actions')
    .update({ status: 'approved', approved_at: nowIso, approved_by: loId, undo_deadline: undoDeadline })
    .eq('lo_id', loId)
    .eq('generated_date', generatedDate)
    .eq('status', 'pending');
  if (error) throw error;

  await sb.from('autopilot_audit_log').insert(
    rows.map((r) => ({ org_id: r.org_id, lo_id: loId, autopilot_action_id: r.id, event: 'approved' as const })),
  );

  return { count: rows.length, undoDeadline };
}
