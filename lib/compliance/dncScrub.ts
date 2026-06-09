/**
 * Phase 58.1 — DNC scrubbing. SERVER-ONLY.
 * Internal suppression + 30-day registry cache are LIVE. National-registry +
 * litigator scrub via DNC_API_KEY is GATED — when unset, registry status is
 * "unknown" and only the internal list governs (we never fabricate a clear).
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export function normalizePhone(raw: string): string {
  const d = (raw ?? '').replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return d ? `+${d}` : '';
}

export interface ScrubResult { phone: string; isOnNationalRegistry: boolean | null; isLitigant: boolean | null; isInternalDNC: boolean; canCall: boolean; canText: boolean; registryGated: boolean }

export async function scrubPhone(orgId: string, rawPhone: string): Promise<ScrubResult> {
  const phone = normalizePhone(rawPhone);
  const sb = createAdminClient();

  // 1. Internal suppression (fast, authoritative for this tenant).
  const { data: internal } = await sb.from('dnc_entries').select('channel').eq('org_id', orgId).eq('phone_number', phone);
  const callBlock = (internal ?? []).some((e) => e.channel === 'call' || e.channel === 'all');
  const smsBlock = (internal ?? []).some((e) => e.channel === 'sms' || e.channel === 'all');
  const isInternalDNC = (internal ?? []).length > 0;

  // 2. Registry cache.
  const { data: cached } = await sb.from('dnc_scrub_cache').select('is_on_registry, is_litigant, expires_at').eq('phone_number', phone).maybeSingle();
  let onRegistry: boolean | null = null;
  let isLitigant: boolean | null = null;
  if (cached && new Date(cached.expires_at) > new Date()) { onRegistry = cached.is_on_registry; isLitigant = cached.is_litigant; }

  // 3. Registry API (GATED).
  const apiKey = process.env.DNC_API_KEY;
  if (onRegistry === null && apiKey) {
    try {
      const res = await fetch(`${process.env.DNC_API_BASE ?? 'https://api.dnc.com'}/scrub`, { method: 'POST', headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ phones: [phone] }) });
      if (res.ok) {
        const r = await res.json();
        onRegistry = !!r.on_registry; isLitigant = !!r.is_litigant;
        await sb.from('dnc_scrub_cache').upsert({ phone_number: phone, is_on_registry: onRegistry, is_litigant: isLitigant, scrubbed_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString() });
      }
    } catch { /* registry unavailable → treat as unknown */ }
  }
  const registryGated = onRegistry === null;

  // canCall: blocked by internal call/all, registry, or litigant. If registry unknown
  // (gated), the internal list governs — we don't auto-clear, the caller sees registryGated.
  const canCall = !callBlock && onRegistry !== true && isLitigant !== true;
  const canText = !smsBlock; // SMS exempt from national DNC unless STOP reply (→ internal)
  return { phone, isOnNationalRegistry: onRegistry, isLitigant, isInternalDNC, canCall, canText, registryGated };
}
