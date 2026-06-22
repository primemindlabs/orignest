/**
 * Arive (LOS) REST client — SERVER-ONLY.
 *
 * Arive exposes a per-broker REST API at the broker's own `*.myarive.com`
 * subdomain (the stored base_url), authenticated with an `X-API-KEY` header.
 * It is fetch-by-id only:
 *   GET /api/loans/{id}   → full loan
 *   GET /api/leads/{id}   → full lead
 * Push is via native hook subscriptions (we register our callback URL):
 *   GET  /api/hooks            → our subscriptions (also a cheap auth ping)
 *   POST /api/hooks/subscribe  → { WebhookUrl, Event }
 * A fired hook delivers only { id, event }; we then GET the record to enrich.
 */
import 'server-only';

export const ARIVE_EVENTS = [
  'LOAN_CREATED', 'LOAN_ARCHIVED', 'LOAN_STAGE_CHANGED', 'LOAN_DATE_CHANGED',
  'LOAN_TRACKERS_UPDATED', 'LOAN_APP_SUBMITTED', 'LEAD_CREATED', 'LEAD_UPDATED',
] as const;
export type AriveEvent = (typeof ARIVE_EVENTS)[number];

// The events we act on (status/identity changes). Trackers/date-only changes are
// noisy and don't move a pipeline stage, so we don't subscribe to them.
export const SUBSCRIBE_EVENTS: AriveEvent[] = ['LOAN_CREATED', 'LOAN_STAGE_CHANGED', 'LOAN_APP_SUBMITTED', 'LEAD_CREATED', 'LEAD_UPDATED'];

/**
 * Normalize the broker's base URL to its ORIGIN (scheme + host), or null if unset.
 * Tolerates someone pasting a full page URL like
 * "https://2393595.myarive.com/app/loans?ref=343" → "https://2393595.myarive.com",
 * which would otherwise make every API call hit the SPA and return HTML.
 */
export function ariveBase(baseUrl?: string | null): string | null {
  let raw = (baseUrl || '').trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try { return new URL(raw).origin; } catch { return null; }
}

type AriveResult = { ok: true; data: Record<string, any> } | { ok: false; status?: number; error: string };

async function ariveGet(base: string, apiKey: string, path: string): Promise<AriveResult> {
  const url = `${base}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'X-API-KEY': apiKey, Accept: 'application/json' } });
  } catch (e) {
    return { ok: false, error: `Could not reach Arive at ${url}: ${(e as Error).message}` };
  }
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    return { ok: false, status: res.status, error: `Arive ${res.status} at ${url}. ${text.slice(0, 200)}`.trim() };
  }
  // A 200 that isn't JSON is the SPA/web-app shell — almost always a wrong Base URL.
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json') && !text.trim().startsWith('{') && !text.trim().startsWith('[')) {
    return { ok: false, status: res.status, error: `Arive returned ${ct || 'non-JSON'} (the web app, not the API) at ${url}. Check the Base URL is just https://<name>.myarive.com with no /app/... path.` };
  }
  try {
    return { ok: true, data: JSON.parse(text) as Record<string, any> };
  } catch {
    return { ok: false, status: res.status, error: `Arive returned unparseable JSON at ${url}.` };
  }
}

export const getAriveRecord = (base: string, apiKey: string, kind: 'loan' | 'lead', id: string) =>
  ariveGet(base, apiKey, kind === 'lead' ? `/api/leads/${id}` : `/api/loans/${id}`);

interface SearchOpts { limit?: number; offset?: number; orderBy?: string; sort?: string }
function searchQuery(o: SearchOpts): string {
  return new URLSearchParams({
    limit: String(o.limit ?? 100), offset: String(o.offset ?? 0),
    orderBy: o.orderBy ?? 'updatedAt', sort: o.sort ?? 'DESC',
  }).toString();
}
/** Paginated loan search → { count, rows }. */
export const searchAriveLoans = (base: string, apiKey: string, o: SearchOpts = {}) => ariveGet(base, apiKey, `/api/loans?${searchQuery(o)}`);
/** Paginated lead search → bare array. */
export const searchAriveLeads = (base: string, apiKey: string, o: SearchOpts = {}) => ariveGet(base, apiKey, `/api/leads?${searchQuery(o)}`);

/** Map a loan- or lead-list row to an imported_loans (Inbound queue) staged row. */
export function mapAriveToStaged(orgId: string, raw: Record<string, any>): Record<string, any> {
  const arr: any[] = Array.isArray(raw.loanBorrowers) ? raw.loanBorrowers : [];
  const b = raw.borrower ?? arr.find((x) => x?.applicantType === 'Borrower') ?? arr[0] ?? {};
  const prop = raw.subjectProperty ?? {};
  return {
    org_id: orgId, source: 'arive', status: 'pending',
    external_id: String(raw.sysGUID ?? raw.ariveLoanId ?? raw.ariveLeadId ?? ''),
    borrower_first_name: b.firstName ?? null,
    borrower_last_name: b.lastName ?? null,
    borrower_email: (b.emailAddressText ?? '').toLowerCase() || null,
    borrower_phone: b.mobilePhone10digit ?? null,
    loan_amount: raw.baseLoanAmount ?? raw.totalLoanAmount ?? null,
    loan_type: raw.mortgageType ?? null,
    loan_purpose: raw.loanPurpose ?? null,
    property_address: prop.addressLineText ?? prop.lineText ?? null,
    stage: raw?.currentLoanStatus?.status ?? raw.leadStatus ?? null,
    raw,
  };
}

/** List our hook subscriptions — also the cheapest way to validate key + base_url. */
export const listAriveHooks = (base: string, apiKey: string) => ariveGet(base, apiKey, '/api/hooks');

/** Subscribe one event to a callback URL. */
export async function subscribeAriveHook(base: string, apiKey: string, webhookUrl: string, event: AriveEvent): Promise<{ ok: boolean; error?: string }> {
  const url = `${base}/api/hooks/subscribe`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ WebhookUrl: webhookUrl, Event: event }),
    });
    if (!res.ok) {
      const snippet = (await res.text().catch(() => '')).slice(0, 150);
      return { ok: false, error: `${event} → ${res.status}. ${snippet}`.trim() };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `${event}: ${(e as Error).message}` };
  }
}

/** Register all SUBSCRIBE_EVENTS for a callback URL. Best-effort; returns a summary. */
export async function subscribeAriveHooks(base: string, apiKey: string, webhookUrl: string): Promise<{ subscribed: number; failures: string[] }> {
  const results = await Promise.all(SUBSCRIBE_EVENTS.map((e) => subscribeAriveHook(base, apiKey, webhookUrl, e)));
  const failures = results.map((r, i) => (r.ok ? null : `${SUBSCRIBE_EVENTS[i]}: ${r.error}`)).filter(Boolean) as string[];
  return { subscribed: results.filter((r) => r.ok).length, failures };
}

// ── Field mapping → the canonical shape matchOrCreateLead consumes ──────────────
// Arive's loan and lead objects differ (loanBorrowers[] vs borrower{}); normalize
// both to { borrower:{firstName,lastName,email,phone}, status, ... }.

export interface NormalizedArive {
  borrower: { firstName?: string; lastName?: string; email?: string; phone?: string };
  status: string | null;
  loanAmount: number | null;
  crmReferenceId: string | null;
  smsOptOut?: boolean;
  emailOptOut?: boolean;
}

export function normalizeAriveLoan(loan: Record<string, any>): NormalizedArive {
  const arr: any[] = Array.isArray(loan.loanBorrowers) ? loan.loanBorrowers : [];
  const b = arr.find((x) => x?.applicantType === 'Borrower') ?? arr[0] ?? {};
  return {
    borrower: { firstName: b.firstName, lastName: b.lastName, email: b.emailAddressText, phone: b.mobilePhone10digit },
    status: loan?.currentLoanStatus?.status ?? null,
    loanAmount: loan.totalLoanAmount ?? loan.baseLoanAmount ?? null,
    crmReferenceId: loan.crmReferenceId ?? null,
  };
}

export function normalizeAriveLead(lead: Record<string, any>): NormalizedArive {
  const b = lead.borrower ?? {};
  return {
    borrower: { firstName: b.firstName, lastName: b.lastName, email: b.emailAddressText, phone: b.mobilePhone10digit },
    status: lead?.leadStatus ?? null,
    loanAmount: lead.baseLoanAmount ?? null,
    crmReferenceId: lead.crmReferenceId ?? null,
    smsOptOut: !!lead.smsOptOut,
    emailOptOut: !!lead.emailOptOut,
  };
}
