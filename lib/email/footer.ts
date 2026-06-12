/**
 * Phase 38.2 — CAN-SPAM email footer (sender identity + physical address +
 * one-click unsubscribe). Append to every outbound marketing email.
 */
import { createUnsubscribeToken } from '@/lib/email/unsubscribeToken';

export function unsubscribeUrl(orgId: string | null, email: string, leadId?: string | null): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
  return `${base}/api/unsubscribe?token=${encodeURIComponent(createUnsubscribeToken(orgId, email, leadId))}`;
}

export function emailFooter(opts: { companyName: string; address?: string | null; orgId: string | null; email: string; leadId?: string | null }): string {
  const address = opts.address || process.env.COMPANY_PHYSICAL_ADDRESS || process.env.PRIMEMIND_PHYSICAL_ADDRESS || '';
  const url = unsubscribeUrl(opts.orgId, opts.email, opts.leadId);
  return `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
      <p>${opts.companyName}${address ? ` · ${address}` : ''}</p>
      <p>You're receiving this because you opted in to communications. <a href="${url}" style="color:#9ca3af;">Unsubscribe</a></p>
    </div>`;
}

/** Company display name for CAN-SPAM sender identity. */
export function companyName(): string {
  return process.env.COMPANY_NAME || 'AshleyIQ';
}

/** Plain-text variant of the compliance footer (for text/* emails). Throws if no address. */
export function complianceFooterText(opts: { orgId: string | null; email: string; leadId?: string | null }): string {
  const address = requirePhysicalAddress();
  return `\n\n--\n${companyName()} | ${address} | To unsubscribe: ${unsubscribeUrl(opts.orgId, opts.email, opts.leadId)}`;
}

/**
 * The CAN-SPAM physical address. THROWS if neither COMPANY_PHYSICAL_ADDRESS nor
 * PRIMEMIND_PHYSICAL_ADDRESS is set — callers must NOT send mail without it.
 */
export function requirePhysicalAddress(): string {
  const address = process.env.COMPANY_PHYSICAL_ADDRESS || process.env.PRIMEMIND_PHYSICAL_ADDRESS;
  if (!address) {
    throw new Error(
      'COMPANY_PHYSICAL_ADDRESS is not set — refusing to send email without a CAN-SPAM physical mailing address.',
    );
  }
  return address;
}

/**
 * CAN-SPAM compliance footer in the required format:
 *   "[COMPANY_NAME] | [COMPANY_PHYSICAL_ADDRESS] | To unsubscribe: [url]"
 * Throws (via requirePhysicalAddress) if the physical-address env is missing, so
 * a non-compliant email can never be assembled.
 */
export function complianceFooterHtml(opts: { orgId: string | null; email: string; leadId?: string | null }): string {
  const address = requirePhysicalAddress();
  const company = companyName();
  const url = unsubscribeUrl(opts.orgId, opts.email, opts.leadId);
  return `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
      <p>${company} | ${address} | To unsubscribe: <a href="${url}" style="color:#9ca3af;">${url}</a></p>
    </div>`;
}
