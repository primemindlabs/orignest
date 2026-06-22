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

/** Normalize the broker's base URL (their *.myarive.com), or null if unset. */
export function ariveBase(baseUrl?: string | null): string | null {
  const b = (baseUrl || '').trim().replace(/\/+$/, '');
  if (!b) return null;
  return b.startsWith('http') ? b : `https://${b}`;
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
  if (!res.ok) {
    const snippet = (await res.text().catch(() => '')).slice(0, 200);
    return { ok: false, status: res.status, error: `Arive ${res.status} at ${url}. ${snippet}`.trim() };
  }
  return { ok: true, data: (await res.json().catch(() => ({}))) as Record<string, any> };
}

export const getAriveRecord = (base: string, apiKey: string, kind: 'loan' | 'lead', id: string) =>
  ariveGet(base, apiKey, kind === 'lead' ? `/api/leads/${id}` : `/api/loans/${id}`);

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
