/**
 * Arive (LOS) loan PULL → import review queue. SERVER-ONLY, GATED.
 *
 * Arive's integration is otherwise inbound-webhook-only, so this adds an explicit
 * pull: list the org's loans from Arive and stage NEW ones into imported_loans
 * (the /inbound review queue) for the LO to promote. Inert (returns {gated}) when
 * no active Arive connection. Mirrors the auth/base/shape used in lib/los/syncLoan.
 *
 * ⚠️ Endpoint/response shape follow assumptions (GET /loans paginated by
 * limit/offset, OAuth2 bearer via lib/los/ariveAuth, borrower{firstName,…}).
 * Confirm against Arive's partner API for the org's account before relying on it
 * — everything is isolated to this file.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLosConnection, getLosCredentials, logSyncEvent } from '@/lib/los/connection';
import { ariveBase, getAriveToken } from '@/lib/los/ariveAuth';

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
  let creds: { apiKey: string; apiSecret: string | null } | null;
  try {
    creds = await getLosCredentials(orgId, 'arive');
  } catch (e) {
    return { gated: true, reason: `Stored Arive credentials couldn't be read (re-enter them in Settings → Integrations). ${(e as Error).message}` };
  }
  if (!creds) return { gated: true, reason: 'No active Arive connection — add your Arive credentials in Settings → Integrations.' };
  const conn = await getLosConnection(orgId, 'arive');
  const base = ariveBase(conn?.base_url);

  // Arive authenticates via OAuth2 client-credentials: Client ID + Secret → bearer token.
  const auth = await getAriveToken(base, creds.apiKey, creds.apiSecret);
  if ('error' in auth) {
    await logSyncEvent({ orgId, losType: 'arive', eventType: 'pull', direction: 'inbound', result: 'error', error: auth.error });
    return { gated: true, reason: auth.error };
  }

  // Page through the loan list (offset-based). Previously a single 200-loan call
  // silently truncated larger pipelines; MAX_PAGES caps total work to stay within
  // this route's 60s budget. Stop on a short/empty page (the last one).
  const LIMIT = 200;
  const MAX_PAGES = 10;
  const loans: Record<string, any>[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${base}/loans?limit=${LIMIT}&offset=${page * LIMIT}`;
    let batch: Record<string, any>[];
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${auth.token}`, Accept: 'application/json' } });
      if (!res.ok) {
        const bodySnippet = (await res.text().catch(() => '')).slice(0, 200);
        const reason = `Arive API ${res.status} at ${url}. ${bodySnippet}`.trim();
        await logSyncEvent({ orgId, losType: 'arive', eventType: 'pull', direction: 'inbound', result: 'error', error: reason });
        return { gated: true, reason };
      }
      const j = await res.json();
      batch = Array.isArray(j) ? j : Array.isArray(j.data) ? j.data : Array.isArray(j.loans) ? j.loans : [];
    } catch (e) {
      const reason = `Could not reach Arive at ${url}: ${(e as Error).message}`;
      await logSyncEvent({ orgId, losType: 'arive', eventType: 'pull', direction: 'inbound', result: 'error', error: reason });
      return { gated: true, reason };
    }
    loans.push(...batch);
    if (batch.length < LIMIT) break;
  }

  // De-dupe by external_id within the pull itself (last value wins) so an API that
  // ignores `offset` and re-returns the same page can't stage duplicate rows.
  const byId = new Map<string, ReturnType<typeof mapLoan>>();
  for (const l of loans) { const m = mapLoan(l); if (m.external_id) byId.set(m.external_id, m); }
  const mapped = [...byId.values()];
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
