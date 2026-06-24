/**
 * Phase 150 — generic VOI/VOE adapter. SERVER-ONLY.
 *
 * Lowest-common-denominator verification: POSTs the applicant identity + employer to
 * the vendor's configured endpoint and parses verified employment/income out of a
 * tolerant set of JSON shapes. GATED: returns { gated:true } (never throws) when the
 * endpoint or credential is missing, so nothing is transmitted and no fake figures
 * are recorded.
 *
 * Real vendors (Truework, The Work Number / Equifax, Plaid Income) speak proprietary
 * JSON; those are structured stubs in the registry that wire to this shape — only
 * their adapter file changes when wired natively.
 */
import 'server-only';
import type { VoieAdapter, VoieConnection, DecryptedCreds, VoieInput, VoieResult, VoieEmployment, VoieIncome } from './types';

function authHeaders(conn: VoieConnection, creds: DecryptedCreds): Record<string, string> {
  if (conn.auth_type === 'bearer' && creds.apiKey) return { Authorization: `Bearer ${creds.apiKey}` };
  if (conn.auth_type === 'api_key' && creds.apiKey) return { 'X-API-KEY': creds.apiKey };
  if (conn.auth_type === 'basic' && creds.apiKey) return { Authorization: `Basic ${Buffer.from(`${creds.apiKey}:${creds.apiSecret ?? ''}`).toString('base64')}` };
  return {};
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function str(v: unknown): string | null {
  const s = v == null ? '' : String(v).trim();
  return s ? s : null;
}

/** Pull employment out of common shapes: {employment:{...}}, {employer,title,status}, flat. */
function readEmployment(b: Record<string, any>): VoieEmployment {
  const e = b.employment ?? b.employmentRecord ?? b;
  return {
    employerName: str(e.employerName ?? e.employer_name ?? e.employer ?? e.companyName ?? e.company),
    jobTitle: str(e.jobTitle ?? e.job_title ?? e.title ?? e.position),
    status: str(e.status ?? e.employmentStatus ?? e.employment_status),
    startDate: str(e.startDate ?? e.start_date ?? e.hireDate ?? e.hire_date),
    endDate: str(e.endDate ?? e.end_date ?? e.terminationDate ?? e.termination_date),
  };
}

/** Pull income out of common shapes: {income:{annual,monthly}}, flat, payFrequency. */
function readIncome(b: Record<string, any>): VoieIncome {
  const i = b.income ?? b.incomeRecord ?? b;
  const annual = num(i.annualIncome ?? i.annual_income ?? i.annual ?? i.yearlyIncome ?? i.grossAnnual);
  const monthly = num(i.monthlyIncome ?? i.monthly_income ?? i.monthly ?? i.grossMonthly);
  return {
    annualIncome: annual ?? (monthly != null ? Math.round(monthly * 12) : null),
    monthlyIncome: monthly ?? (annual != null ? Math.round((annual / 12) * 100) / 100 : null),
    payFrequency: str(i.payFrequency ?? i.pay_frequency ?? i.frequency),
  };
}

function readVerified(b: Record<string, any>, status: string): boolean {
  if (typeof b.verified === 'boolean') return b.verified;
  const s = String(b.status ?? b.verificationStatus ?? '').toLowerCase();
  if (s) return ['verified', 'completed', 'complete', 'confirmed', 'success'].some((k) => s.includes(k));
  return status === 'completed';
}

export const genericVoieAdapter: VoieAdapter = {
  vendor: 'generic',
  async verify(conn, creds, input: VoieInput): Promise<VoieResult> {
    if (!conn.api_url) return { gated: true, status: 'gated', error: 'No verification endpoint configured for this vendor.' };
    if (conn.auth_type !== 'none' && !creds.apiKey) return { gated: true, status: 'gated', error: 'No API credential stored for this vendor.' };

    let res: Response;
    try {
      res = await fetch(conn.api_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders(conn, creds) },
        body: JSON.stringify({
          accountId: conn.account_id ?? undefined,
          verificationType: input.verificationType,
          method: input.method,
          applicant: input.applicant,
        }),
      });
    } catch (e) {
      return { status: 'error', error: `Could not reach verification vendor at ${conn.api_url}: ${(e as Error).message}` };
    }

    const text = await res.text().catch(() => '');
    let body: Record<string, any> = {};
    try { body = text && text.trim().startsWith('{') ? JSON.parse(text) : {}; } catch { /* */ }
    if (!res.ok) return { status: 'error', raw: { status: res.status, body: text.slice(0, 600) }, error: `Verification vendor returned ${res.status}. ${text.slice(0, 200)}`.trim() };

    // Some vendors return an order id and verify asynchronously (manual VOE).
    const reportRef = str(body.verificationId ?? body.report_ref ?? body.referenceNumber ?? body.id ?? body.orderId);
    const pending = String(body.status ?? '').toLowerCase().includes('pending') || String(body.status ?? '').toLowerCase().includes('processing');
    if (pending) return { status: 'pending', verified: false, reportRef, raw: body };

    const employment = input.verificationType === 'income' ? {} : readEmployment(body);
    const income = input.verificationType === 'employment' ? {} : readIncome(body);
    return { status: 'completed', verified: readVerified(body, 'completed'), employment, income, reportRef, raw: body };
  },
};
