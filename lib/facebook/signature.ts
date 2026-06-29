/** Verify Meta's X-Hub-Signature-256 webhook signature. SERVER-ONLY. */
import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';

/** header = "sha256=" + HMAC_SHA256(appSecret, rawBody). Constant-time compare. */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !appSecret) return false;
  const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
