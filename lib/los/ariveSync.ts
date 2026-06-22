/**
 * Arive entity sync — SERVER-ONLY.
 *
 * Driven by a fired hook (which carries only an id + event): fetch the full
 * loan/lead via the REST API, map it onto a lead, and apply Arive's status as
 * the authoritative stage. Keyed on the Arive sysGUID; falls back to email/phone
 * matching (so a lead that converts to a loan reuses the same record).
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLosConnection, getLosCredentials, logSyncEvent } from '@/lib/los/connection';
import { mapLosStatus } from '@/lib/los/statusMap';
import { matchOrCreateLead } from '@/lib/los/syncLoan';
import { ariveBase, ariveToken, getAriveRecord, normalizeAriveLoan, normalizeAriveLead } from '@/lib/los/arive';

export async function syncAriveEntity(orgId: string, kind: 'loan' | 'lead', ariveId: string): Promise<{ ok: boolean; reason?: string }> {
  const creds = await getLosCredentials(orgId, 'arive');
  const conn = await getLosConnection(orgId, 'arive');
  const base = ariveBase(conn?.base_url);
  if (!creds?.apiKey || !base) {
    await logSyncEvent({ orgId, losType: 'arive', losLoanId: ariveId, eventType: 'webhook', direction: 'inbound', result: 'skipped', error: 'arive not connected (no api key / base url)' });
    return { ok: false, reason: 'not_connected' };
  }

  const auth = await ariveToken(base, creds.apiKey, creds.apiSecret);
  if ('error' in auth) {
    await logSyncEvent({ orgId, losType: 'arive', losLoanId: ariveId, eventType: 'sync_error', direction: 'inbound', result: 'error', error: auth.error });
    return { ok: false, reason: auth.error };
  }

  const rec = await getAriveRecord(base, creds.apiKey, kind, ariveId, auth.token);
  if (!rec.ok) {
    await logSyncEvent({ orgId, losType: 'arive', losLoanId: ariveId, eventType: 'sync_error', direction: 'inbound', result: 'error', error: rec.error });
    return { ok: false, reason: rec.error };
  }

  const norm = kind === 'lead' ? normalizeAriveLead(rec.data) : normalizeAriveLoan(rec.data);
  const sysGUID = String(rec.data?.sysGUID ?? ariveId);
  const leadId = await matchOrCreateLead(orgId, { borrower: norm.borrower }, 'arive', sysGUID);
  if (!leadId) {
    await logSyncEvent({ orgId, losType: 'arive', losLoanId: sysGUID, eventType: 'sync_error', direction: 'inbound', result: 'error', error: 'could not match or create lead' });
    return { ok: false, reason: 'no_lead' };
  }

  const sb = createAdminClient();
  const stage = norm.status ? mapLosStatus('arive', String(norm.status)) : null;
  const update: Record<string, any> = { los_loan_id: sysGUID, los_type: 'arive', los_last_synced_at: new Date().toISOString() };
  if (stage) update.stage = stage; // unknown Arive status → no stage change (non-destructive)
  await sb.from('leads').update(update).eq('id', leadId).eq('org_id', orgId);

  // Honor Arive's opt-out flags for TCPA (best-effort; separate so a column quirk
  // can't block the stage update).
  if (norm.smsOptOut) {
    await sb.from('leads').update({ sms_consent: false }).eq('id', leadId).eq('org_id', orgId).then(() => undefined, () => undefined);
  }

  await sb.from('los_connections').update({ last_sync_at: new Date().toISOString(), sync_error: null }).eq('org_id', orgId).eq('los_type', 'arive');
  await logSyncEvent({ orgId, losType: 'arive', losLoanId: sysGUID, eventType: kind === 'lead' ? 'lead_sync' : 'status_changed', direction: 'inbound', payload: { stage, kind }, result: 'success' });
  return { ok: true };
}
