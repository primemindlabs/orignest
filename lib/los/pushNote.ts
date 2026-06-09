/**
 * Phase 41.5 — push an Ashley IQ note to the linked LOS loan file (outbound).
 * GATED: no-ops (logs 'skipped') when the loan isn't LOS-linked or no live
 * credentials exist. Keyed on the lead (no loan_files table in this schema).
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLosCredentials, logSyncEvent, type LosType } from '@/lib/los/connection';

export async function pushNoteToLos(orgId: string, leadId: string, note: string, authorName: string): Promise<{ pushed: boolean; gated?: boolean }> {
  const sb = createAdminClient();
  const { data: map } = await sb.from('los_loan_map').select('los_type, los_loan_id').eq('org_id', orgId).eq('ashley_lead_id', leadId).maybeSingle();
  if (!map) return { pushed: false }; // not LOS-linked — skip silently

  const losType = map.los_type as LosType;
  const creds = await getLosCredentials(orgId, losType);
  if (!creds) {
    await logSyncEvent({ orgId, losType, losLoanId: map.los_loan_id, eventType: 'note_pushed', direction: 'outbound', payload: { note }, result: 'skipped', error: 'no_live_credentials' });
    return { pushed: false, gated: true };
  }

  const formatted = `[Ashley IQ — ${authorName}] ${note}`;
  try {
    if (losType === 'lendingpad') {
      const tok = await fetch('https://api.lendingpad.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'client_credentials', client_id: creds.apiKey, client_secret: creds.apiSecret ?? '', scope: 'loans:write' }) });
      const { access_token } = await tok.json();
      await fetch(`https://api.lendingpad.com/v1/loans/${map.los_loan_id}/notes`, { method: 'POST', headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ content: formatted }) });
    } else if (losType === 'arive') {
      await fetch(`https://api.arive.com/v1/loans/${map.los_loan_id}/notes`, { method: 'POST', headers: { 'x-api-key': creds.apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ note: formatted }) });
    }
    await logSyncEvent({ orgId, losType, losLoanId: map.los_loan_id, eventType: 'note_pushed', direction: 'outbound', payload: { note }, result: 'success' });
    return { pushed: true };
  } catch (e) {
    await logSyncEvent({ orgId, losType, losLoanId: map.los_loan_id, eventType: 'note_pushed', direction: 'outbound', payload: { note }, result: 'error', error: String(e) });
    return { pushed: false };
  }
}
