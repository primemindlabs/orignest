/**
 * Phase 142 — LoanPASS PPE adapter. SERVER-ONLY. GATED: inert until a tenant
 * connects a real LoanPASS API key (AES-encrypted in ppe_connections, provider
 * = 'loanpass'). LoanPASS exposes a public REST API that calls its pricing engine
 * and returns JSON pricing (docs.loanpass.io/public-api).
 *
 * ⚠️ STUB: the request body + response parsing below follow the documented public
 * API shape, but LoanPASS pricing is driven by TENANT-CONFIGURED "credit application
 * fields" (field-id/value pairs) unique to each customer's product setup. Before
 * going live, confirm the execute endpoint path and map our scenario → the tenant's
 * field IDs (and the product/price-scenario response shape) against your LoanPASS
 * configuration. Everything is structured so only this file changes.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto/encrypt';

export interface LoanPassInputs {
  lead_id: string;
  loan_amount: number;
  property_value: number;
  credit_score: number;
  ltv: number;
  loan_type?: string;
  loan_purpose?: string;
  occupancy?: string;
  property_type?: string;
  state?: string;
  term_years?: number;
  lock_days?: number;
}

export interface LoanPassProduct {
  productName?: string;
  rate?: number;
  price?: number;
  term?: number;        // months
  lockDays?: number;
  amortizationType?: string;
  interestOnly?: boolean;
  prepaymentPenalty?: boolean;
  balloon?: boolean;
  negativeAmortization?: boolean;
}
export interface LoanPassQuote { products: LoanPassProduct[]; product_count: number }

/** Map our normalized scenario → LoanPASS "credit application fields".
 *  Field IDs are tenant-specific — these are the common defaults; verify per tenant. */
function toCreditApplicationFields(i: LoanPassInputs): { fieldId: string; value: unknown }[] {
  return [
    { fieldId: 'loan-amount', value: i.loan_amount },
    { fieldId: 'property-value', value: i.property_value },
    { fieldId: 'ltv', value: i.ltv },
    { fieldId: 'fico', value: i.credit_score },
    { fieldId: 'loan-purpose', value: i.loan_purpose ?? null },
    { fieldId: 'occupancy', value: i.occupancy ?? null },
    { fieldId: 'property-type', value: i.property_type ?? null },
    { fieldId: 'state', value: i.state ?? null },
    { fieldId: 'loan-term', value: (i.term_years ?? 30) * 12 },
    { fieldId: 'lock-period', value: i.lock_days ?? 30 },
  ].filter((f) => f.value !== null && f.value !== undefined);
}

/** PURE: flatten a LoanPASS pricing response into a product list. Tolerant of the
 *  common shapes (products[].priceScenarios[] | products[].pricing[] | flat). */
export function parseLoanPassResponse(raw: unknown): LoanPassQuote {
  const r = (raw ?? {}) as { products?: unknown[]; results?: unknown[] };
  const rows = Array.isArray(r.products) ? r.products : Array.isArray(r.results) ? r.results : [];
  const out: LoanPassProduct[] = [];

  for (const row of rows as Record<string, unknown>[]) {
    const name = (row.productName ?? row.name ?? row.product) as string | undefined;
    const scenarios =
      (Array.isArray(row.priceScenarios) ? row.priceScenarios :
       Array.isArray(row.pricing) ? row.pricing :
       Array.isArray(row.scenarios) ? row.scenarios : null) as Record<string, unknown>[] | null;

    if (scenarios) {
      for (const s of scenarios) {
        const rate = num(s.rate ?? s.noteRate);
        if (rate == null) continue;
        out.push({
          productName: name,
          rate,
          price: num(s.price ?? s.adjustedPrice ?? s.priceAdjustedPoints) ?? undefined,
          term: num(s.termMonths ?? row.termMonths) ?? undefined,
          lockDays: num(s.lockPeriod ?? s.lockDays) ?? undefined,
          amortizationType: (s.amortizationType ?? row.amortizationType) as string | undefined,
        });
      }
    } else {
      const rate = num(row.rate ?? row.noteRate);
      if (rate == null) continue;
      out.push({ productName: name, rate, price: num(row.price) ?? undefined, term: num(row.termMonths) ?? undefined, lockDays: num(row.lockDays) ?? undefined });
    }
  }
  return { products: out, product_count: out.length };
}

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** Fetch live LoanPASS pricing. Returns {gated:true} (never throws) when no active
 *  LoanPASS connection exists, so the engine degrades to rate sheets. */
export async function fetchLoanPassRates(
  orgId: string,
  inputs: LoanPassInputs,
): Promise<{ gated: true; reason: string } | { gated: false; quote: LoanPassQuote }> {
  const sb = createAdminClient();
  const { data: conn } = await sb
    .from('ppe_connections')
    .select('id, api_key_enc, api_base_url')
    .eq('org_id', orgId)
    .eq('provider', 'loanpass')
    .eq('is_active', true)
    .maybeSingle();
  if (!conn) return { gated: true, reason: 'No LoanPASS connection configured' };

  let apiKey: string;
  try { apiKey = decrypt(conn.api_key_enc); } catch { return { gated: true, reason: 'Stored LoanPASS credential could not be read' }; }

  const base = conn.api_base_url || 'https://api.loanpass.io/v1';
  let raw: unknown;
  try {
    // ⚠️ Verify the execute path against docs.loanpass.io/public-api for your tenant.
    const res = await fetch(`${base}/execute-summary`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ creditApplicationFields: toCreditApplicationFields(inputs) }),
    });
    if (!res.ok) return { gated: true, reason: `LoanPASS pricing API error ${res.status}` };
    raw = await res.json();
  } catch (e) { return { gated: true, reason: `LoanPASS request failed: ${(e as Error).message}` }; }

  await sb.from('ppe_connections').update({ last_successful_query_at: new Date().toISOString() }).eq('id', conn.id);
  return { gated: false, quote: parseLoanPassResponse(raw) };
}
