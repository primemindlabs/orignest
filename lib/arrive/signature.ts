/**
 * Phase 94 — HMAC-SHA256 signing/verification for Arrive webhooks.
 * Shared by the webhook handler and the settings "test connection" endpoint so
 * both exercise the exact same verification path.
 */
import { createHmac, timingSafeEqual } from 'crypto';

/** Returns the `sha256=<hex>` header value Arrive sends in `x-arrive-signature`. */
export function signArrive(body: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

/** Constant-time verification of an incoming Arrive signature header. */
export function verifyArriveSignature(body: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = signArrive(body, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
