/**
 * Phase 56.1 — Optimal Blue (ICE PPE) product & pricing. SERVER-ONLY. GATED: does
 * nothing until a tenant connects a real OB key (AES-encrypted in ppe_connections).
 * Rate/APR data is internal-only — never surfaced in the borrower portal.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto/encrypt';

export interface OBQuoteInputs { lead_id: string; loan_amount: number; property_value: number; credit_score: number; property_type?: string; occupancy?: string; loan_purpose?: string; loan_type?: string; state?: string; county?: string; lock_days?: number }

interface OBProduct { rate?: number; price?: number; apr?: number; productName?: string; term?: number }
export interface OBRateQuote { products: OBProduct[]; best30YrFixed: { rate: number; price?: number; apr?: number } | null; product_count: number }

/** Pure parse of an OB pricing response → best 30yr fixed + product list. */
export function parseOBResponse(raw: unknown): OBRateQuote {
  const r = (raw ?? {}) as { products?: OBProduct[]; pricingProducts?: OBProduct[] };
  const products = r.products ?? r.pricingProducts ?? [];
  const thirty = products.filter((p) => (p.productName ?? '').includes('30 Year') || p.term === 360).sort((a, b) => (a.rate ?? 99) - (b.rate ?? 99))[0];
  return { products, best30YrFixed: thirty ? { rate: thirty.rate ?? 0, price: thirty.price, apr: thirty.apr } : null, product_count: products.length };
}

/** Fetch live rates. Returns {gated:true} (never throws to the caller) when no
 * active OB connection exists, so Scenario AI degrades gracefully. */
export async function fetchOBRates(orgId: string, inputs: OBQuoteInputs): Promise<{ gated: true; reason: string } | { gated: false; quote: OBRateQuote }> {
  const sb = createAdminClient();
  const { data: conn } = await sb.from('ppe_connections').select('id, api_key_enc, api_base_url, ob_business_channel_id').eq('org_id', orgId).eq('provider', 'optimal_blue').eq('is_active', true).maybeSingle();
  if (!conn) return { gated: true, reason: 'No Optimal Blue connection configured' };

  let apiKey: string;
  try { apiKey = decrypt(conn.api_key_enc); } catch { return { gated: true, reason: 'Stored OB credential could not be read' }; }

  let raw: unknown;
  try {
    const res = await fetch(`${conn.api_base_url}/pricing/products`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'OB-Business-Channel': conn.ob_business_channel_id ?? '' },
      body: JSON.stringify({ loanAmount: inputs.loan_amount, ltv: (inputs.loan_amount / Math.max(1, inputs.property_value)) * 100, ficoScore: inputs.credit_score, propertyType: inputs.property_type, occupancy: inputs.occupancy, loanPurpose: inputs.loan_purpose, loanType: inputs.loan_type, propertyState: inputs.state, propertyCounty: inputs.county, lockDays: inputs.lock_days ?? 30 }),
    });
    if (!res.ok) return { gated: true, reason: `OB pricing API error ${res.status}` };
    raw = await res.json();
  } catch (e) { return { gated: true, reason: `OB request failed: ${(e as Error).message}` }; }

  const quote = parseOBResponse(raw);
  await sb.from('ppe_rate_quotes').insert({ org_id: orgId, lead_id: inputs.lead_id, connection_id: conn.id, quote_inputs: inputs, raw_response: raw as object, best_30yr_fixed: quote.best30YrFixed?.rate ?? null, best_30yr_fixed_price: quote.best30YrFixed?.price ?? null, product_count: quote.product_count, expires_at: new Date(Date.now() + 20 * 60_000).toISOString() });
  await sb.from('ppe_connections').update({ last_successful_query_at: new Date().toISOString() }).eq('id', conn.id);
  return { gated: false, quote };
}
