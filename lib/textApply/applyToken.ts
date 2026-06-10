/**
 * Phase 68 — signed apply-token for the pre-populated 1003 link. SERVER-ONLY.
 * HMAC-SHA256 (no jsonwebtoken dep), 72-hour TTL. Payload carries the pre-qual data
 * (consumer phone is NOT included — only a reference). base64url(payload).sig.
 */
import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';

const TTL_MS = 72 * 60 * 60 * 1000;
function secret(): string { return process.env.APPLY_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'ashley-iq-apply-fallback'; }

export interface ApplyPayload { lead_id: string; org_id: string; lo_id?: string; keyword?: string; property_address?: string | null; estimated_value?: number | null; credit_range?: string | null; iat: number; exp: number }

export function generateApplyToken(data: Omit<ApplyPayload, 'iat' | 'exp'>): string {
  const now = Date.now();
  const payload: ApplyPayload = { ...data, iat: now, exp: now + TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyApplyToken(token: string): ApplyPayload | null {
  const [body, sig] = (token ?? '').split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ApplyPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}
