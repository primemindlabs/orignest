/**
 * Phase 147 — generic credit-vendor adapter. SERVER-ONLY.
 *
 * Lowest-common-denominator pull: POSTs the applicant identity to the vendor's
 * configured endpoint and parses tri-bureau scores out of a tolerant set of JSON
 * shapes. GATED: returns { gated:true } (never throws) when the endpoint or
 * credential is missing, so nothing is transmitted and no fake scores are recorded.
 *
 * Real vendors (Factual Data, MeridianLink/CBC, Xactus, Credco) speak MISMO credit
 * 2.4 XML or proprietary JSON; those are structured stubs in the registry that wire
 * to this shape — only their adapter file changes.
 */
import 'server-only';
import type { CreditAdapter, CreditConnection, DecryptedCreds, CreditPullInput, CreditPullResult, CreditScores } from './types';

function authHeaders(conn: CreditConnection, creds: DecryptedCreds): Record<string, string> {
  if (conn.auth_type === 'bearer' && creds.apiKey) return { Authorization: `Bearer ${creds.apiKey}` };
  if (conn.auth_type === 'api_key' && creds.apiKey) return { 'X-API-KEY': creds.apiKey };
  if (conn.auth_type === 'basic' && creds.apiKey) return { Authorization: `Basic ${Buffer.from(`${creds.apiKey}:${creds.apiSecret ?? ''}`).toString('base64')}` };
  return {};
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Pull scores out of common response shapes: {scores:{equifax}}, {bureaus:[{bureau,score}]}, flat. */
function readScores(body: unknown): CreditScores {
  if (!body || typeof body !== 'object') return {};
  const b = body as Record<string, any>;
  const s: CreditScores = {};
  const src = b.scores ?? b.creditScores ?? b;
  s.equifax = num(src.equifax ?? src.eqfx ?? src.EQ);
  s.experian = num(src.experian ?? src.xpn ?? src.EX);
  s.transunion = num(src.transunion ?? src.tu ?? src.TU);
  // bureaus[] form
  const arr: any[] = Array.isArray(b.bureaus) ? b.bureaus : Array.isArray(b.creditBureaus) ? b.creditBureaus : [];
  for (const row of arr) {
    const name = String(row.bureau ?? row.name ?? '').toLowerCase();
    const score = num(row.score ?? row.creditScore);
    if (name.includes('equi')) s.equifax = s.equifax ?? score;
    else if (name.includes('exper')) s.experian = s.experian ?? score;
    else if (name.includes('trans')) s.transunion = s.transunion ?? score;
  }
  return s;
}

export const genericCreditAdapter: CreditAdapter = {
  vendor: 'generic',
  async pull(conn, creds, input: CreditPullInput): Promise<CreditPullResult> {
    if (!conn.api_url) return { gated: true, status: 'gated', error: 'No credit endpoint configured for this vendor.' };
    if (conn.auth_type !== 'none' && !creds.apiKey) return { gated: true, status: 'gated', error: 'No API credential stored for this vendor.' };

    let res: Response;
    try {
      res = await fetch(conn.api_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders(conn, creds) },
        body: JSON.stringify({
          accountId: conn.account_id ?? undefined,
          pullType: input.pullType,
          applicant: input.applicant,
          bureaus: ['equifax', 'experian', 'transunion'],
        }),
      });
    } catch (e) {
      return { status: 'error', error: `Could not reach credit vendor at ${conn.api_url}: ${(e as Error).message}` };
    }

    const text = await res.text().catch(() => '');
    let body: Record<string, any> = {};
    try { body = text && text.trim().startsWith('{') ? JSON.parse(text) : {}; } catch { /* */ }
    if (!res.ok) return { status: 'error', raw: { status: res.status, body: text.slice(0, 600) }, error: `Credit vendor returned ${res.status}. ${text.slice(0, 200)}`.trim() };

    const scores = readScores(body);
    const reportRef = body.reportId ?? body.report_ref ?? body.referenceNumber ?? body.id ?? null;
    const tradelineCount = num(body.tradelineCount ?? body.tradeline_count ?? (Array.isArray(body.tradelines) ? body.tradelines.length : null));
    return { status: 'completed', scores, reportRef: reportRef != null ? String(reportRef) : null, tradelineCount, raw: body };
  },
};
