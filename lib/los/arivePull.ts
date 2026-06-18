/**
 * Arive (LOS) loan PULL → import review queue. SERVER-ONLY, GATED.
 *
 * Arive's integration is otherwise inbound-webhook-only, so this adds an explicit
 * pull: list the org's loans from Arive and stage NEW ones into imported_loans
 * (the /inbound review queue) for the LO to promote. Inert (returns {gated}) when
 * no active Arive connection. Mirrors the auth/base/shape used in lib/los/syncLoan.
 *
 * ⚠️ Endpoint/auth/response shape follow the existing assumptions (GET /v1/loans,
 * x-api-key, borrower{firstName,…}). Confirm against Arive's partner API for the
 * org's account before relying on it — everything is isolated to this file.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLosConnection, getLosCredentials, logSyncEvent } from '@/lib/los/connection';

const num = (v: unknown) => { const x = Number(String(v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(x) && x > 0 ? x : null; };

function mapLoan(loan: Record<string, any>) {
  const b = loan.borrower ?? loan.primaryBorrower ?? {};
  const prop = loan.property ?? {};
  return {
    external_id: String(loan.id ?? loan.loanId ?? loan.loanNumber ?? ''),
    borrower_first_name: b.firstName ?? b.first_name ?? null,
    borrower_last_name: b.lastName ?? b.last_name ?? null,
    borrower_email: (b.email ?? '').toLowerCase() || null,
    borrower_phone: b.phone ?? b.mobilePhone ?? null,
    loan_amount: num(loan.loanAmount ?? loan.amount),
    loan_type: loan.loanType ?? loan.programType ?? null,
    loan_purpose: loan.loanPurpose ?? loan.purpose ?? null,
    property_address: prop.address ?? prop.streetAddress ?? loan.propertyAddress ?? null,
    stage: loan.status ?? loan.milestone ?? null,
    raw: loan,
  };
}

export async function pullAriveLoans(
  orgId: string,
): Promise<{ gated: true; reason: string } | { gated: false; staged: number; seen: number }> {
  const creds = await getLosCredentials(orgId, 'arive');
  if (!creds) return { gated: true, reason: 'No active Arive connection configured' };
  const conn = await getLosConnection(orgId, 'arive');
  const base = conn?.base_url || 'https://api.arive.com/v1';

  let loans: Record<string, any>[] = [];
  try {
    const res = await fetch(`${base}/loans?limit=200`, { headers: { 'x-api-key': creds.apiKey, Accept: 'application/json' } });
    if (!res.ok) {
      await logSyncEvent({ orgId, losType: 'arive', eventType: 'pull', direction: 'inbound', result: 'error', error: `Arive list API ${res.status}` });
      return { gated: true, reason: `Arive returned ${res.status} — verify the API key/endpoint.` };
    }
    const j = await res.json();
    loans = Array.isArray(j) ? j : Array.isArray(j.data) ? j.data : Array.isArray(j.loans) ? j.loans : [];
  } catch (e) {
    await logSyncEvent({ orgId, losType: 'arive', eventType: 'pull', direction: 'inbound', result: 'error', error: String(e) });
    return { gated: true, reason: 'Could not reach Arive — check the connection.' };
  }

  const mapped = loans.map(mapLoan).filter((m) => m.external_id);
  const sb = createAdminClient();

  // Skip loans already staged (any status) or already imported as a lead.
  const { data: existing } = await sb.from('imported_loans').select('external_id').eq('org_id', orgId).eq('source', 'arive');
  const seenIds = new Set((existing ?? []).map((e) => e.external_id));
  const { data: leadMapped } = await sb.from('leads').select('los_loan_id').eq('org_id', orgId).eq('los_type', 'arive').not('los_loan_id', 'is', null);
  for (const l of leadMapped ?? []) seenIds.add(l.los_loan_id as string);

  const fresh = mapped.filter((m) => !seenIds.has(m.external_id)).map((m) => ({ org_id: orgId, source: 'arive', status: 'pending', ...m }));
  if (fresh.length) {
    await sb.from('imported_loans').insert(fresh);
  }
  await logSyncEvent({ orgId, losType: 'arive', eventType: 'pull', direction: 'inbound', result: 'success', payload: { seen: mapped.length, staged: fresh.length } });
  await sb.from('los_connections').update({ last_sync_at: new Date().toISOString(), sync_error: null }).eq('org_id', orgId).eq('los_type', 'arive');

  return { gated: false, staged: fresh.length, seen: mapped.length };
}
