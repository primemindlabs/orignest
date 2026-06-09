/**
 * Phase 38.2 — signed one-click unsubscribe tokens (HMAC-SHA256, node crypto —
 * no extra dependency). Format: base64url(payload).base64url(sig). 30-day expiry.
 */
import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';

function secret(): string {
  return process.env.UNSUBSCRIBE_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'ashley-iq-unsub-fallback';
}
function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export interface UnsubPayload {
  org_id: string | null;
  email: string;
  lead_id?: string | null;
  exp: number; // epoch seconds
}

export function createUnsubscribeToken(orgId: string | null, email: string, leadId?: string | null): string {
  const payload: UnsubPayload = { org_id: orgId, email, lead_id: leadId ?? null, exp: Math.floor(Date.now() / 1000) + 30 * 86_400 };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac('sha256', secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): UnsubPayload | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', secret()).update(body).digest();
  const given = fromB64url(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as UnsubPayload;
    if (!payload.email || (payload.exp && payload.exp < Math.floor(Date.now() / 1000))) return null;
    return payload;
  } catch {
    return null;
  }
}
