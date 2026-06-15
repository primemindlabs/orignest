/**
 * Phase 137 — branded application-link URL builder.
 *
 * Borrowers reach an LO's full Smart-1003 at one of two equivalent URLs:
 *   • Subdomain (branded):  https://{brokerage}.ashleyiq.com/{mlo}
 *   • Path (always works):   https://ashleyiq.com/apply/o/{brokerage}/{mlo}
 *
 * The subdomain form is what we *display* once `NEXT_PUBLIC_APPLY_SUBDOMAINS=1`
 * AND wildcard DNS (`*.ashleyiq.com`) is live in Vercel. Until then we show the
 * path form so no shared link ever 404s. The middleware rewrites the subdomain
 * form to the path form, so both resolve to the same route regardless of the flag.
 */

/** Root domain for branded subdomains. `NEXT_PUBLIC_APP_DOMAIN` overrides. */
export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'ashleyiq.com';

/** Subdomains that are the app itself, never a brokerage portal. */
export const RESERVED_SUBDOMAINS = new Set(['', 'www', 'app', 'api', 'admin', 'dev', 'staging', 'preview']);

const SUBDOMAINS_ENABLED = process.env.NEXT_PUBLIC_APPLY_SUBDOMAINS === '1';

function appBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? `https://${ROOT_DOMAIN}`).replace(/\/$/, '');
}

/** Canonical internal route for a branded link (what the middleware rewrites to). */
export function applyPath(orgSlug: string, mloSlug?: string | null): string {
  return mloSlug ? `/apply/o/${orgSlug}/${mloSlug}` : `/apply/o/${orgSlug}`;
}

/**
 * The shareable URL to show an LO. Subdomain form when enabled, else path form.
 */
export function buildApplyUrl(orgSlug: string, mloSlug?: string | null): string {
  if (SUBDOMAINS_ENABLED) {
    const path = mloSlug ? `/${mloSlug}` : '';
    return `https://${orgSlug}.${ROOT_DOMAIN}${path}`;
  }
  return `${appBase()}${applyPath(orgSlug, mloSlug)}`;
}
