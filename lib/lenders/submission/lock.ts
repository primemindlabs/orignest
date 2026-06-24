/**
 * Phase 143 — wholesale rate-lock orchestrator. SERVER-ONLY.
 *
 * requestLockWithLender(orgId, loanId, connectionId, loId, req): dispatches a lock /
 * extend / float-down / cancel request to the lender's platform adapter and records
 * a loan_locks row. Gated-safe: when no lock endpoint/credential is configured the
 * row is kept (status 'requested') with the gated reason — nothing fake is locked.
 *
 * This is the OUTBOUND lock at the wholesale lender, distinct from the INTERNAL
 * rate_lock_requests approval workflow (P52/P104). When the lock confirms we link
 * the most recent submission for this loan, if any.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto/encrypt';
import { getLenderAdapter } from './registry';
import type { SubmissionConnection, DecryptedCreds, LockRequest } from './types';

const CONN_COLS = 'id, org_id, lender_name, platform, submit_url, lock_url, status_url, auth_type, base_url, api_key_enc, api_secret_enc, is_active';

export type LockOutcome =
  | { ok: false; status: 404 | 400; error: string }
  | { ok: true; gated: boolean; lock: Record<string, any> };

export async function requestLockWithLender(
  orgId: string, loanId: string, connectionId: string, loId: string | null,
  req: Omit<LockRequest, 'loanId' | 'externalLoanId'>,
): Promise<LockOutcome> {
  const sb = createAdminClient();

  const { data: conn } = await sb.from('lender_submission_connections').select(CONN_COLS).eq('id', connectionId).eq('org_id', orgId).maybeSingle();
  if (!conn) return { ok: false, status: 404, error: 'Lender connection not found.' };
  if (!conn.is_active) return { ok: false, status: 400, error: 'That lender connection is inactive.' };

  // Link the most recent submission for this loan to this lender (for the external ref).
  const { data: lastSub } = await sb.from('loan_submissions')
    .select('id, external_loan_id').eq('org_id', orgId).eq('lead_id', loanId).eq('connection_id', conn.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  const creds: DecryptedCreds = {
    apiKey: conn.api_key_enc ? safeDecrypt(conn.api_key_enc) : null,
    apiSecret: conn.api_secret_enc ? safeDecrypt(conn.api_secret_enc) : null,
  };
  const connView: SubmissionConnection = {
    id: conn.id, org_id: conn.org_id, lender_name: conn.lender_name, platform: conn.platform,
    submit_url: conn.submit_url, lock_url: conn.lock_url, status_url: conn.status_url,
    auth_type: conn.auth_type, base_url: conn.base_url,
  };

  const adapter = getLenderAdapter(conn.platform);
  const result = await adapter.lock(connView, creds, {
    loanId, externalLoanId: lastSub?.external_loan_id ?? null,
    action: req.action, productName: req.productName ?? null,
    requestedRate: req.requestedRate ?? null, requestedPrice: req.requestedPrice ?? null,
    lockPeriodDays: req.lockPeriodDays ?? null,
  });

  const confirmed = result.status === 'confirmed';
  const { data: saved } = await sb.from('loan_locks').insert({
    org_id: orgId, lead_id: loanId, connection_id: conn.id, submission_id: lastSub?.id ?? null, lo_id: loId,
    lender_name: conn.lender_name, action: req.action, product_name: req.productName ?? null,
    requested_rate: req.requestedRate ?? null, requested_price: req.requestedPrice ?? null, lock_period_days: req.lockPeriodDays ?? null,
    locked_rate: result.lockedRate ?? null, locked_price: result.lockedPrice ?? null,
    lock_number: result.lockNumber ?? null, lock_expiration: result.lockExpiration ?? null,
    status: result.status, external_status: result.externalStatus ?? null,
    response_meta: result.responseMeta ?? null, error_message: result.error ?? null,
    confirmed_at: confirmed ? new Date().toISOString() : null,
  }).select('*').single();

  if (result.gated || result.status === 'error') {
    await sb.from('lender_submission_connections').update({ last_error: result.error ?? 'lock failed', updated_at: new Date().toISOString() }).eq('id', conn.id);
  }

  return { ok: true, gated: !!result.gated, lock: saved ?? {} };
}

function safeDecrypt(enc: string): string | null {
  try { return decrypt(enc); } catch { return null; }
}
