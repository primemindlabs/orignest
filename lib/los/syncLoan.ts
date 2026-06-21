/**
 * Phase 41.3/41.6 — inbound loan sync from a REST LOS (LendingPad).
 * GATED: returns early (logging 'skipped') when no live credentials are stored,
 * so it's inert until the LOS API is connected. No fake loan data is written.
 *
 * Adapted to the real schema: loans are `leads` (no loan_files), so status maps
 * onto leads.stage and matching/creation happens on the leads table.
 *
 * matchOrCreateLead is also reused by the Arive webhook (Zapier push), so its
 * field extraction tolerates both nested and flat payload shapes.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLosCredentials, logSyncEvent, type LosType } from '@/lib/los/connection';
import { mapLosStatus } from '@/lib/los/statusMap';

// REST pull-back fetch. Only LendingPad exposes a public loan API; Arive is
// inbound-only via Zapier (/api/webhooks/arive processes the posted body
// directly) and BytePro is webhook-only — neither is fetched here.
async function fetchLoan(losType: LosType, creds: { apiKey: string; apiSecret: string | null }, loanId: string): Promise<Record<string, unknown> | null> {
  try {
    if (losType === 'lendingpad') {
      const tok = await fetch('https://api.lendingpad.com/oauth/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: creds.apiKey, client_secret: creds.apiSecret ?? '', scope: 'loans:read' }),
      });
      if (!tok.ok) return null;
      const { access_token } = await tok.json();
      const r = await fetch(`https://api.lendingpad.com/v1/loans/${loanId}`, { headers: { Authorization: `Bearer ${access_token}` } });
      return r.ok ? r.json() : null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function matchOrCreateLead(orgId: string, loan: Record<string, any>, losType: LosType, losLoanId: string): Promise<string | null> {
  const sb = createAdminClient();
  // Accept either nested (borrower.email) or flat (Zapier-mapped) field shapes.
  const b = loan.borrower ?? loan.primaryBorrower ?? {};
  const email = (b.email ?? loan.email ?? loan.borrowerEmail ?? '').toLowerCase() || null;
  const phone = b.phone ?? b.mobilePhone ?? loan.phone ?? loan.borrowerPhone ?? null;
  const firstName = b.firstName ?? b.first_name ?? loan.firstName ?? loan.borrowerFirstName ?? '';
  const lastName = b.lastName ?? b.last_name ?? loan.lastName ?? loan.borrowerLastName ?? '';

  let leadId: string | null = null;
  if (email) {
    const { data } = await sb.from('leads').select('id').eq('org_id', orgId).ilike('email', email).limit(1).maybeSingle();
    leadId = data?.id ?? null;
  }
  if (!leadId && phone) {
    const { data } = await sb.from('leads').select('id').eq('org_id', orgId).eq('phone', phone).limit(1).maybeSingle();
    leadId = data?.id ?? null;
  }
  if (!leadId) {
    const { data } = await sb.from('leads').insert({
      org_id: orgId,
      first_name: firstName,
      last_name: lastName,
      email, phone, data_ownership: 'company_generated', lead_source: `los_sync_${losType}`,
      stage: 'application', los_loan_id: losLoanId, los_type: losType,
    }).select('id').single();
    leadId = data?.id ?? null;
  }
  if (leadId) {
    await sb.from('los_loan_map').upsert({ org_id: orgId, los_type: losType, los_loan_id: losLoanId, ashley_lead_id: leadId, last_synced_at: new Date().toISOString() }, { onConflict: 'org_id,los_type,los_loan_id', ignoreDuplicates: false });
  }
  return leadId;
}

export async function syncLoanFromLos(orgId: string, losType: LosType, losLoanId: string): Promise<{ ok: boolean; gated?: boolean }> {
  const creds = await getLosCredentials(orgId, losType);
  if (!creds) {
    await logSyncEvent({ orgId, losType, losLoanId, eventType: 'status_changed', direction: 'inbound', result: 'skipped', error: 'no_live_credentials' });
    return { ok: false, gated: true };
  }

  const loan = await fetchLoan(losType, creds, losLoanId);
  if (!loan) {
    await logSyncEvent({ orgId, losType, losLoanId, eventType: 'sync_error', direction: 'inbound', result: 'error', error: 'los_fetch_failed' });
    return { ok: false };
  }

  const sb = createAdminClient();
  const { data: map } = await sb.from('los_loan_map').select('ashley_lead_id').eq('org_id', orgId).eq('los_type', losType).eq('los_loan_id', losLoanId).maybeSingle();
  const leadId = map?.ashley_lead_id ?? (await matchOrCreateLead(orgId, loan, losType, losLoanId));

  const stage = mapLosStatus(losType, String((loan as any).status ?? ''));
  if (leadId && stage) {
    // LOS is the system of record — apply its stage authoritatively.
    await sb.from('leads').update({ stage, los_loan_id: losLoanId, los_type: losType, los_last_synced_at: new Date().toISOString() }).eq('id', leadId).eq('org_id', orgId);
  }
  await sb.from('los_loan_map').update({ last_synced_at: new Date().toISOString() }).eq('org_id', orgId).eq('los_type', losType).eq('los_loan_id', losLoanId);
  await logSyncEvent({ orgId, losType, losLoanId, eventType: 'status_changed', direction: 'inbound', payload: { stage }, result: 'success' });
  // TODO(conditions): upsert loan conditions → loan_conditions once the LOS condition payload shape is confirmed.
  return { ok: true };
}
