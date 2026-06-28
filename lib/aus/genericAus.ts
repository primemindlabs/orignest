/**
 * Phase 151 — generic AUS adapter. SERVER-ONLY.
 *
 * Lowest-common-denominator AUS: POSTs the MISMO 3.4 (ULAD) URLA file produced by
 * lib/mismo to the AUS's configured endpoint, and parses the underwriting
 * recommendation, eligibility, risk class, and findings out of a tolerant set of JSON
 * shapes. This is what "AUS-agnostic" means in practice — any DU/LPA gateway that
 * accepts a MISMO 3.4 upload over HTTPS and returns JSON findings can be wired by just
 * storing its endpoint + an API credential.
 *
 * Fannie's DU and Freddie's LPA speak proprietary request/response envelopes; those are
 * structured stubs in the registry that wire to this shape — only their adapter file
 * changes when wired natively.
 *
 * GATED: returns { gated:true } (never throws) when the endpoint or credential is
 * missing, so nothing is transmitted and no fake recommendation is recorded.
 */
import 'server-only';
import type { AusAdapter, AusConnection, DecryptedCreds, AusInput, AusResult, AusRecommendation, AusFinding } from './types';

function authHeaders(conn: AusConnection, creds: DecryptedCreds): Record<string, string> {
  if (conn.auth_type === 'bearer' && creds.apiKey) return { Authorization: `Bearer ${creds.apiKey}` };
  if (conn.auth_type === 'api_key' && creds.apiKey) return { 'X-API-KEY': creds.apiKey };
  if (conn.auth_type === 'basic' && creds.apiKey)
    return { Authorization: `Basic ${Buffer.from(`${creds.apiKey}:${creds.apiSecret ?? ''}`).toString('base64')}` };
  return {};
}

function str(v: unknown): string | null {
  const s = v == null ? '' : String(v).trim();
  return s ? s : null;
}
function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Map any vendor wording to the canonical recommendation. */
export function normalizeRecommendation(raw: string | null): AusRecommendation {
  const s = (raw ?? '').toLowerCase();
  if (!s) return 'unknown';
  if (s.includes('approve')) return 'approve';
  if (s.includes('accept')) return 'accept';
  if (s.includes('refer') && s.includes('caution')) return 'refer_with_caution';
  if (s.includes('caution')) return 'caution';
  if (s.includes('refer')) return 'refer';
  if (s.includes('out of scope') || s.includes('out_of_scope') || s.includes('outofscope')) return 'out_of_scope';
  if (s.includes('ineligible')) return 'ineligible';
  if (s.includes('incomplete')) return 'incomplete';
  if (s.includes('invalid') || s.includes('error')) return 'error';
  return 'unknown';
}

/** Read findings out of arrays of strings or objects under a handful of common keys. */
function readFindings(b: Record<string, any>): AusFinding[] {
  const src =
    b.findings ?? b.messages ?? b.verificationMessages ?? b.verification_messages ??
    b.conditions ?? b.approvalConditions ?? b.approval_conditions ?? b.observations ?? null;
  if (!Array.isArray(src)) return [];
  const out: AusFinding[] = [];
  for (const item of src) {
    if (item == null) continue;
    if (typeof item === 'string') { const t = item.trim(); if (t) out.push({ text: t }); continue; }
    if (typeof item === 'object') {
      const o = item as Record<string, any>;
      const text = str(o.text ?? o.message ?? o.description ?? o.messageText ?? o.finding ?? o.condition);
      if (!text) continue;
      out.push({
        code: str(o.code ?? o.messageCode ?? o.id ?? o.ruleId),
        category: str(o.category ?? o.type ?? o.area ?? o.section),
        severity: str(o.severity ?? o.level ?? o.messageType ?? o.kind),
        text,
      });
    }
  }
  return out.slice(0, 200);
}

function readEligibility(b: Record<string, any>, rec: string | null): 'eligible' | 'ineligible' | null {
  if (typeof b.eligible === 'boolean') return b.eligible ? 'eligible' : 'ineligible';
  const e = String(b.eligibility ?? b.eligibilityStatus ?? '').toLowerCase();
  if (e.includes('ineligible')) return 'ineligible';
  if (e.includes('eligible')) return 'eligible';
  const r = (rec ?? '').toLowerCase();
  if (r.includes('ineligible')) return 'ineligible';
  if (r.includes('eligible')) return 'eligible';
  return null;
}

export const genericAusAdapter: AusAdapter = {
  vendor: 'generic',
  async submit(conn, creds, input: AusInput): Promise<AusResult> {
    if (!conn.api_url) return { gated: true, status: 'gated', error: 'No AUS endpoint configured for this provider — add its MISMO ingest URL.' };
    if (conn.auth_type !== 'none' && !creds.apiKey) return { gated: true, status: 'gated', error: 'No API credential stored for this AUS provider.' };

    let res: Response;
    try {
      res = await fetch(conn.api_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          Accept: 'application/json',
          'X-AUS-System': input.system,            // 'du' | 'lpa' — gateway routes accordingly
          ...(conn.account_id ? { 'X-AUS-Account': conn.account_id } : {}),
          ...authHeaders(conn, creds),
        },
        body: input.mismoXml,
      });
    } catch (e) {
      return { status: 'error', error: `Could not reach the AUS at ${conn.api_url}: ${(e as Error).message}` };
    }

    const text = await res.text().catch(() => '');
    let body: Record<string, any> = {};
    try { body = text && text.trim().startsWith('{') ? JSON.parse(text) : {}; } catch { /* non-JSON ack */ }
    if (!res.ok) return { status: 'error', raw: { status: res.status, body: text.slice(0, 600) }, error: `AUS returned ${res.status}. ${text.slice(0, 200)}`.trim() };

    const statusStr = String(body.status ?? body.aus_status ?? '').toLowerCase();
    if (statusStr.includes('pending') || statusStr.includes('processing') || statusStr.includes('queued')) {
      const reportRef = str(body.caseFileId ?? body.casefileId ?? body.ausKey ?? body.referenceNumber ?? body.id);
      return { status: 'pending', reportRef, caseFileId: reportRef, raw: body };
    }

    const rawRec = str(
      body.recommendation ?? body.underwritingRecommendation ?? body.underwriting_recommendation ??
      body.decision ?? body.ausRecommendation ?? body.aus_recommendation ?? body.result,
    );
    const recommendation = normalizeRecommendation(rawRec);
    const caseFileId = str(body.caseFileId ?? body.casefileId ?? body.casefile_id ?? body.ausKey ?? body.aus_key ?? body.keyNumber);

    return {
      status: 'completed',
      recommendation,
      rawRecommendation: rawRec,
      eligibility: readEligibility(body, rawRec),
      riskClass: str(body.riskClass ?? body.risk_class ?? body.creditRiskClass ?? body.riskAssessment),
      caseFileId,
      dti: num(body.dti ?? body.debtToIncome ?? body.dtiRatio ?? body.totalDti),
      ltv: num(body.ltv ?? body.loanToValue ?? body.ltvRatio),
      findings: readFindings(body),
      reportRef: str(body.reportRef ?? body.report_ref ?? body.findingsReportId) ?? caseFileId,
      raw: body,
    };
  },
};
