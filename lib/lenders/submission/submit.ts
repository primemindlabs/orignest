/**
 * Phase 143 — wholesale submission orchestrator. SERVER-ONLY.
 *
 * submitLoanToLender(orgId, loanId, connectionId, loId):
 *   1. load + verify the lender connection (active, same org)
 *   2. build the MISMO 3.4 file from the authoritative application (reused export)
 *   3. decrypt the lender credential at call time
 *   4. record a loan_submissions row (with the MISMO snapshot) BEFORE dispatch
 *   5. dispatch to the platform adapter (gated-safe — nothing fake is ever sent)
 *   6. persist the outcome onto the row + the connection's last_submission/last_error
 *
 * Gated outcome: the row is kept (status 'queued') with the MISMO snapshot and a
 * gated reason, so the file is prepared and audited even before a lender endpoint
 * is configured. Returns the saved submission row plus a `gated` flag.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto/encrypt';
import { buildUrlaForLoan } from '@/lib/mismo/loadUrlaInput';
import { getLenderAdapter } from './registry';
import type { SubmissionConnection, DecryptedCreds } from './types';

const CONN_COLS = 'id, org_id, lender_name, platform, submit_url, lock_url, status_url, auth_type, base_url, api_key_enc, api_secret_enc, is_active';

export type SubmitOutcome =
  | { ok: false; status: 404 | 400; error: string }
  | { ok: true; gated: boolean; submission: Record<string, any> };

export async function submitLoanToLender(orgId: string, loanId: string, connectionId: string, loId: string | null): Promise<SubmitOutcome> {
  const sb = createAdminClient();

  const { data: conn } = await sb.from('lender_submission_connections').select(CONN_COLS).eq('id', connectionId).eq('org_id', orgId).maybeSingle();
  if (!conn) return { ok: false, status: 404, error: 'Lender connection not found.' };
  if (!conn.is_active) return { ok: false, status: 400, error: 'That lender connection is inactive.' };

  const built = await buildUrlaForLoan(orgId, loanId);
  if (!built.ok) return { ok: false, status: built.status, error: built.error };

  const creds: DecryptedCreds = {
    apiKey: conn.api_key_enc ? safeDecrypt(conn.api_key_enc) : null,
    apiSecret: conn.api_secret_enc ? safeDecrypt(conn.api_secret_enc) : null,
  };

  const connView: SubmissionConnection = {
    id: conn.id, org_id: conn.org_id, lender_name: conn.lender_name, platform: conn.platform,
    submit_url: conn.submit_url, lock_url: conn.lock_url, status_url: conn.status_url,
    auth_type: conn.auth_type, base_url: conn.base_url,
  };

  // Record the attempt (with the snapshot) before we dispatch.
  const { data: row } = await sb.from('loan_submissions').insert({
    org_id: orgId, lead_id: loanId, connection_id: conn.id, lo_id: loId,
    lender_name: conn.lender_name, platform: conn.platform, status: 'queued',
    mismo_snapshot: built.xml,
    request_meta: { borrower_last_name: built.lead.last_name ?? null, loan_amount: built.lead.loan_amount ?? null },
  }).select('*').single();

  const adapter = getLenderAdapter(conn.platform);
  const result = await adapter.submit(connView, creds, {
    loanId, mismoXml: built.xml, borrowerLastName: built.lead.last_name, loanAmount: built.lead.loan_amount,
  });

  const now = new Date().toISOString();
  const update: Record<string, any> = {
    status: result.status,
    external_loan_id: result.externalLoanId ?? null,
    external_status: result.externalStatus ?? null,
    response_meta: result.responseMeta ?? null,
    error_message: result.error ?? null,
    last_status_at: now,
    submitted_at: result.gated ? null : now,
  };
  const { data: saved } = row
    ? await sb.from('loan_submissions').update(update).eq('id', row.id).select('*').single()
    : { data: null };

  await sb.from('lender_submission_connections').update(
    result.gated || result.status === 'error'
      ? { last_error: result.error ?? 'submission failed', updated_at: now }
      : { last_submission_at: now, last_error: null, updated_at: now }
  ).eq('id', conn.id);

  return { ok: true, gated: !!result.gated, submission: saved ?? { ...update, lead_id: loanId, lender_name: conn.lender_name } };
}

function safeDecrypt(enc: string): string | null {
  try { return decrypt(enc); } catch { return null; }
}
