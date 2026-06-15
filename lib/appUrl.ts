/**
 * Phase 138 — canonical absolute base URL for links sent OUTSIDE the app
 * (SMS/email portal links, certificates, invites). The previous
 * `process.env.NEXT_PUBLIC_APP_URL ?? ''` fallback produced domain-less links
 * (e.g. "/status/abc") when the env var was unset or scheme-less, so borrower
 * portal links didn't resolve. This always returns a valid https origin.
 */
export function appBaseUrl(): string {
  let raw = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (!raw && process.env.NEXT_PUBLIC_APP_DOMAIN) raw = process.env.NEXT_PUBLIC_APP_DOMAIN.trim();
  if (!raw) raw = 'https://ashleyiq.com';
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  return raw.replace(/\/+$/, '');
}

/** Convenience: build an absolute app URL from a path. */
export function appUrl(path: string): string {
  return `${appBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}
