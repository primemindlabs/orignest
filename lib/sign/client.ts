/**
 * Phase 60.1 — PrimeMind Sign client wrapper. SERVER-ONLY. GATED: @primemind/
 * sign-react is not installed and PRIMEMIND_SIGN_API_KEY is unset, so envelope
 * creation returns { gated:true } (never fakes a signing URL). When provisioned,
 * the brand is injected per-LO (white-label) at envelope-creation time.
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export function isSignConfigured(): boolean {
  return !!process.env.PRIMEMIND_SIGN_API_KEY && !!process.env.PRIMEMIND_SIGN_WEBHOOK_SECRET;
}

export interface SignBrand { logoUrl: string | null; primaryColor: string; companyName: string; fromName: string }

/** White-label brand for a tenant + LO. Shows LO + company, never "Ashley IQ". */
export async function getSignBrand(orgId: string, loId?: string): Promise<SignBrand> {
  const sb = createAdminClient();
  const { data: org } = await sb.from('organizations').select('name, brand_color').eq('id', orgId).maybeSingle();
  let fromName = '';
  if (loId) { const { data: lo } = await sb.from('profiles').select('first_name, last_name').eq('id', loId).maybeSingle(); if (lo) fromName = `${lo.first_name ?? ''} ${lo.last_name ?? ''}`.trim(); }
  return { logoUrl: null, primaryColor: (org?.brand_color as string | null) || '#C9A95C', companyName: org?.name ?? '', fromName: fromName && org?.name ? `${fromName} | ${org.name}` : fromName };
}

export type EnvelopeResult = { envelope_id: string; expires_at: string };

/**
 * Create a signing envelope. THROWS LOUDLY when PrimeMind Sign is not provisioned —
 * a silent "gated" return here meant a missing e-sign integration could be swallowed
 * by callers and TRID disclosure sends would quietly no-op. Callers catch and return
 * a 503 so the gap surfaces in logs and to the client.
 */
export async function createEnvelope(_args: { title: string; orgId: string; loId?: string; packageType: string; expiresDays?: number }): Promise<EnvelopeResult> {
  if (!isSignConfigured()) {
    throw new Error('[sign] PrimeMind Sign is not provisioned. Set PRIMEMIND_SIGN_API_KEY + PRIMEMIND_SIGN_WEBHOOK_SECRET and install @primemind/sign-react.');
  }
  // When provisioned: const env = await signClient.createEnvelope({ title, brand: await getSignBrand(orgId, loId), ... }); return { envelope_id: env.id, expires_at: env.expiresAt };
  throw new Error('[sign] @primemind/sign-react is not installed in this deployment.');
}
