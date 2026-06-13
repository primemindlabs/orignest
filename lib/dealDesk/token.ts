/**
 * Phase 120 — AE Deal Desk magic-link token. SERVER-ONLY.
 * HMAC-SHA256 (mirrors lib/textApply/applyToken — no jsonwebtoken dep), 7-day TTL.
 * Lets a lender Account Executive (who has no app login) open the public respond
 * page for one specific pricing request. base64url(payload).sig.
 */
import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
function secret(): string {
  return process.env.DEAL_DESK_TOKEN_SECRET || process.env.APPLY_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'ashley-iq-deal-desk-fallback';
}

export interface DealDeskPayload { request_id: string; org_id: string; iat: number; exp: number }

export function generateDealDeskToken(data: { request_id: string; org_id: string }): string {
  const now = Date.now();
  const payload: DealDeskPayload = { ...data, iat: now, exp: now + TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyDealDeskToken(token: string): DealDeskPayload | null {
  const [body, sig] = (token ?? '').split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as DealDeskPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}
