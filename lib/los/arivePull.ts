/**
 * Arive (LOS) PULL → import review queue (/inbound). SERVER-ONLY.
 *
 * Arive's REST API is fetch/search by X-API-KEY (GET works; the webhook subscribe
 * POST is blocked at their edge, so we don't depend on it). This pages the loan
 * and lead search endpoints and stages NEW records into imported_loans for the LO
 * to review and promote. Inert ({gated}) without an active Arive connection.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLosConnection, getLosCredentials, logSyncEvent } from '@/lib/los/connection';
import { ariveBase, searchAriveLoans, searchAriveLeads, mapAriveToStaged } from '@/lib/los/arive';

const LIMIT = 100;

export async function pullAriveToInbound(
  orgId: string,
  opts: { maxPages?: number } = {},
): Promise<{ gated: true; reason: string } | { gated: false; staged: number; seen: number }> {
  let creds: { apiKey: string; apiSecret: string | null } | null;
  try {
    creds = await getLosCredentials(orgId, 'arive');
  } catch (e) {
    return { gated: true, reason: `Stored Arive credentials couldn't be read — re-enter them. ${(e as Error).message}` };
  }
  if (!creds?.apiKey) return { gated: true, reason: 'No active Arive connection — add your Arive credentials in Settings → Integrations.' };
  const conn = await getLosConnection(orgId, 'arive');
  const base = ariveBase(conn?.base_url);
  if (!base) return { gated: true, reason: 'No Arive Base URL stored — reconnect with your *.myarive.com URL.' };

  const maxPages = opts.maxPages ?? 3;
  const rows: Record<string, any>[] = [];

  // Loans — response is { count, rows }.
  for (let p = 0; p < maxPages; p++) {
    const r = await searchAriveLoans(base, creds.apiKey, { limit: LIMIT, offset: p * LIMIT });
    if (!r.ok) {
      if (p === 0) {
        await logSyncEvent({ orgId, losType: 'arive', eventType: 'pull', direction: 'inbound', result: 'error', error: r.error });
        return { gated: true, reason: r.error };
      }
      break;
    }
    const batch: any[] = Array.isArray(r.data?.rows) ? r.data.rows : Array.isArray(r.data) ? r.data : [];
    rows.push(...batch);
    const count = Number(r.data?.count ?? 0);
    if (batch.length < LIMIT || (count && (p + 1) * LIMIT >= count)) break;
  }

  // Leads — response is a bare array. Don't fail the whole pull if leads error.
  for (let p = 0; p < maxPages; p++) {
    const r = await searchAriveLeads(base, creds.apiKey, { limit: LIMIT, offset: p * LIMIT });
    if (!r.ok) break;
    const batch: any[] = Array.isArray(r.data) ? r.data : Array.isArray(r.data?.rows) ? r.data.rows : [];
    rows.push(...batch);
    if (batch.length < LIMIT) break;
  }

  // Map + de-dupe by external_id (sysGUID).
  const byId = new Map<string, Record<string, any>>();
  for (const raw of rows) { const m = mapAriveToStaged(orgId, raw); if (m.external_id) byId.set(m.external_id, m); }
  const mapped = [...byId.values()];

  const sb = createAdminClient();
  const { data: existing } = await sb.from('imported_loans').select('external_id').eq('org_id', orgId).eq('source', 'arive');
  const seen = new Set((existing ?? []).map((e) => e.external_id));
  const { data: leadMapped } = await sb.from('leads').select('los_loan_id').eq('org_id', orgId).eq('los_type', 'arive').not('los_loan_id', 'is', null);
  for (const l of leadMapped ?? []) seen.add(l.los_loan_id as string);

  const fresh = mapped.filter((m) => !seen.has(m.external_id));
  if (fresh.length) await sb.from('imported_loans').insert(fresh);

  await sb.from('los_connections').update({ last_sync_at: new Date().toISOString(), sync_error: null }).eq('org_id', orgId).eq('los_type', 'arive');
  await logSyncEvent({ orgId, losType: 'arive', eventType: 'pull', direction: 'inbound', result: 'success', payload: { seen: mapped.length, staged: fresh.length } });
  return { gated: false, staged: fresh.length, seen: mapped.length };
}
