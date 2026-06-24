/**
 * Phase 143 — generic MISMO 3.4 submission adapter. SERVER-ONLY.
 *
 * The lowest-common-denominator wholesale adapter: POSTs the MISMO 3.4 (ULAD) URLA
 * file produced by lib/mismo to a lender's configured ingest endpoint, and POSTs a
 * lock request to the configured lock endpoint. This is what "lender-agnostic"
 * means in practice — any lender/AUS that accepts a MISMO 3.4 upload over HTTPS can
 * be wired by just storing its submit_url/lock_url + an API credential.
 *
 * GATED: returns { gated: true } (never throws) when the endpoint or credential is
 * missing, so nothing is transmitted and no fake success is recorded.
 */
import 'server-only';
import type { LenderAdapter, SubmissionConnection, DecryptedCreds, SubmissionPayload, SubmissionResult, LockRequest, LockResult } from './types';

function authHeaders(conn: SubmissionConnection, creds: DecryptedCreds): Record<string, string> {
  if (conn.auth_type === 'bearer' && creds.apiKey) return { Authorization: `Bearer ${creds.apiKey}` };
  if (conn.auth_type === 'api_key' && creds.apiKey) return { 'X-API-KEY': creds.apiKey };
  if (conn.auth_type === 'basic' && creds.apiKey)
    return { Authorization: `Basic ${Buffer.from(`${creds.apiKey}:${creds.apiSecret ?? ''}`).toString('base64')}` };
  return {};
}

/** Pull a lender's loan reference + status out of a tolerant set of response shapes. */
function readExternal(body: unknown): { id: string | null; status: string | null } {
  if (!body || typeof body !== 'object') return { id: null, status: null };
  const b = body as Record<string, any>;
  const id = b.loanId ?? b.loan_id ?? b.id ?? b.referenceNumber ?? b.reference ?? b.fileNumber ?? b.LoanIdentifier ?? null;
  const status = b.status ?? b.loanStatus ?? b.state ?? b.LoanStatusType ?? null;
  return { id: id != null ? String(id) : null, status: status != null ? String(status) : null };
}

export const genericMismoAdapter: LenderAdapter = {
  platform: 'generic_mismo',

  async submit(conn, creds, payload: SubmissionPayload): Promise<SubmissionResult> {
    if (!conn.submit_url) return { gated: true, status: 'queued', error: 'No submission endpoint configured for this lender — add its MISMO ingest URL.' };
    if (conn.auth_type !== 'none' && !creds.apiKey) return { gated: true, status: 'queued', error: 'No API credential stored for this lender.' };

    let res: Response;
    try {
      res = await fetch(conn.submit_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml; charset=utf-8', Accept: 'application/json', ...authHeaders(conn, creds) },
        body: payload.mismoXml,
      });
    } catch (e) {
      return { status: 'error', error: `Could not reach lender at ${conn.submit_url}: ${(e as Error).message}` };
    }

    const text = await res.text().catch(() => '');
    let parsed: unknown = null;
    try { parsed = text && (text.trim().startsWith('{') || text.trim().startsWith('[')) ? JSON.parse(text) : null; } catch { /* non-JSON ack */ }

    if (!res.ok) return { status: 'error', externalStatus: String(res.status), responseMeta: { status: res.status, body: text.slice(0, 500) }, error: `Lender rejected the submission (${res.status}). ${text.slice(0, 200)}`.trim() };

    const { id, status } = readExternal(parsed);
    return { status: 'submitted', externalLoanId: id, externalStatus: status, responseMeta: (parsed as Record<string, unknown>) ?? { ack: text.slice(0, 500) } };
  },

  async lock(conn, creds, req: LockRequest): Promise<LockResult> {
    if (!conn.lock_url) return { gated: true, status: 'requested', error: 'No lock endpoint configured for this lender — add its lock-request URL.' };
    if (conn.auth_type !== 'none' && !creds.apiKey) return { gated: true, status: 'requested', error: 'No API credential stored for this lender.' };

    let res: Response;
    try {
      res = await fetch(conn.lock_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders(conn, creds) },
        body: JSON.stringify({
          action: req.action,
          loanId: req.externalLoanId ?? undefined,
          productName: req.productName ?? undefined,
          rate: req.requestedRate ?? undefined,
          price: req.requestedPrice ?? undefined,
          lockPeriodDays: req.lockPeriodDays ?? undefined,
        }),
      });
    } catch (e) {
      return { status: 'error', error: `Could not reach lender lock endpoint at ${conn.lock_url}: ${(e as Error).message}` };
    }

    const text = await res.text().catch(() => '');
    let body: Record<string, any> = {};
    try { body = text && text.trim().startsWith('{') ? JSON.parse(text) : {}; } catch { /* */ }

    if (!res.ok) return { status: 'error', externalStatus: String(res.status), responseMeta: { status: res.status, body: text.slice(0, 500) }, error: `Lender declined the lock request (${res.status}). ${text.slice(0, 200)}`.trim() };

    const confirmed = req.action === 'cancel' ? 'cancelled' : 'confirmed';
    return {
      status: confirmed,
      lockNumber: body.lockNumber ?? body.lock_id ?? body.confirmationNumber ?? null,
      lockedRate: typeof body.rate === 'number' ? body.rate : typeof body.lockedRate === 'number' ? body.lockedRate : null,
      lockedPrice: typeof body.price === 'number' ? body.price : typeof body.lockedPrice === 'number' ? body.lockedPrice : null,
      lockExpiration: body.lockExpiration ?? body.expiration ?? body.expiresOn ?? null,
      externalStatus: body.status ?? null,
      responseMeta: body,
    };
  },
};
