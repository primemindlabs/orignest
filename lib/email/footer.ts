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
  const address = opts.address || process.env.PRIMEMIND_PHYSICAL_ADDRESS || '';
  const url = unsubscribeUrl(opts.orgId, opts.email, opts.leadId);
  return `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
      <p>${opts.companyName}${address ? ` · ${address}` : ''}</p>
      <p>You're receiving this because you opted in to communications. <a href="${url}" style="color:#9ca3af;">Unsubscribe</a></p>
    </div>`;
}
