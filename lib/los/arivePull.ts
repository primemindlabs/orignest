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
import { ariveBase, ariveToken, searchAriveLoans, searchAriveLeads, mapAriveToStaged } from '@/lib/los/arive';

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

  // Arive's data API is OAuth-gated: exchange Client ID + Secret Key for a token.
  const auth = await ariveToken(base, creds.apiKey, creds.apiSecret);
  if ('error' in auth) {
    await logSyncEvent({ orgId, losType: 'arive', eventType: 'pull', direction: 'inbound', result: 'error', error: auth.error });
    return { gated: true, reason: auth.error };
  }
  const token = auth.token;

  const maxPages = opts.maxPages ?? 3;
  const rows: Record<string, any>[] = [];
  // Diagnostics so a zero-result pull is explainable (auth vs shape vs empty).
  const diag: Record<string, any> = {};

  // Rows can come back bare, or wrapped under various keys — be liberal.
  const extractRows = (data: any): any[] => {
    if (Array.isArray(data)) return data;
    for (const k of ['rows', 'data', 'result', 'results', 'loans', 'leads', 'items']) {
      if (Array.isArray(data?.[k])) return data[k];
      if (Array.isArray(data?.data?.[k])) return data.data[k];
    }
    return [];
  };
  const extractCount = (data: any): number => Number(data?.count ?? data?.total ?? data?.data?.count ?? 0);

  // Loans.
  for (let p = 0; p < maxPages; p++) {
    const r = await searchAriveLoans(base, creds.apiKey, { limit: LIMIT, offset: p * LIMIT }, token);
    if (!r.ok) {
      if (p === 0) {
        await logSyncEvent({ orgId, losType: 'arive', eventType: 'pull', direction: 'inbound', result: 'error', error: `loans: ${r.error}` });
        return { gated: true, reason: `Arive loan search failed — ${r.error}` };
      }
      break;
    }
    const batch = extractRows(r.data);
    if (p === 0) { diag.loansCount = extractCount(r.data); diag.loansFirstPage = batch.length; diag.loansKeys = batch.length === 0 && r.data && !Array.isArray(r.data) ? Object.keys(r.data).slice(0, 12) : undefined; }
    rows.push(...batch);
    const count = extractCount(r.data);
    if (batch.length < LIMIT || (count && (p + 1) * LIMIT >= count)) break;
  }

  // Leads — don't fail the whole pull if leads error.
  for (let p = 0; p < maxPages; p++) {
    const r = await searchAriveLeads(base, creds.apiKey, { limit: LIMIT, offset: p * LIMIT }, token);
    if (!r.ok) { if (p === 0) diag.leadsError = r.error; break; }
    const batch = extractRows(r.data);
    if (p === 0) { diag.leadsFirstPage = batch.length; diag.leadsKeys = batch.length === 0 && r.data && !Array.isArray(r.data) ? Object.keys(r.data).slice(0, 12) : undefined; }
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

  // If Arive returned literally nothing, leave a legible reason on the card instead
  // of a silent "0 imported".
  const emptyNote = rows.length === 0
    ? `Arive returned 0 records (loans page=${diag.loansFirstPage ?? 0}, count=${diag.loansCount ?? 0}; leads page=${diag.leadsFirstPage ?? 0}${diag.leadsError ? `, leads err: ${diag.leadsError}` : ''}). If you have loans in Arive, the API key may lack list access.`.slice(0, 480)
    : null;
  await sb.from('los_connections').update({ last_sync_at: new Date().toISOString(), sync_error: emptyNote }).eq('org_id', orgId).eq('los_type', 'arive');
  await logSyncEvent({ orgId, losType: 'arive', eventType: 'pull', direction: 'inbound', result: 'success', payload: { seen: mapped.length, staged: fresh.length, ...diag } });
  return { gated: false, staged: fresh.length, seen: mapped.length };
}
