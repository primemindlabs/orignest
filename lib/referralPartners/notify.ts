/**
 * Phase 121 — referral-partner milestone update emails. SERVER-ONLY.
 * Professional B2B notes to the referring partner (attorney/CPA/advisor/insurance).
 * Routes through sendCompliantEmail (same canonical, CAN-SPAM-safe path used for
 * realtor B2B emails in Phase 100) and appends an NMLS disclaimer. Logs every send
 * to the INSERT-only partner_update_emails. Gated: if Resend isn't configured the
 * caller still records intent — here we surface { sent:false } and skip the send.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type PartnerUpdateType = 'referral_received' | 'pre_approval' | 'under_contract' | 'funded';

const SUBJECTS: Record<PartnerUpdateType, string> = {
  referral_received: 'Thank you for your referral',
  pre_approval: 'Your referred client is pre-approved',
  under_contract: 'Your referred client is under contract',
  funded: 'Your referred client just closed',
};

function bodyFor(type: PartnerUpdateType, borrower: string, lo: string): string {
  switch (type) {
    case 'referral_received':
      return `I wanted to personally thank you for referring ${borrower} to me. I'll take great care of them and keep you posted on their progress.`;
    case 'pre_approval':
      return `Good news — ${borrower}, the client you referred, is now fully pre-approved and ready to shop with confidence. Thank you again for the introduction.`;
    case 'under_contract':
      return `${borrower}, your referred client, is now under contract. Things are moving smoothly and I'll keep you updated through closing.`;
    case 'funded':
      return `${borrower}, the client you referred to me, closed and funded today. Thank you for the referral — I'd love to keep finding ways for us to work together.`;
  }
}

export async function sendPartnerUpdate(
  sb: SupabaseClient<any, any, any>,
  args: {
    orgId: string;
    partner: { id: string; first_name: string; last_name: string; email: string };
    lo: { first_name: string | null; last_name: string | null; nmls_id: string | null };
    borrowerName: string;
    type: PartnerUpdateType;
    leadId?: string | null;
  },
): Promise<{ sent: boolean }> {
  const loName = [args.lo.first_name, args.lo.last_name].filter(Boolean).join(' ') || 'Your loan officer';
  const nmls = args.lo.nmls_id ? `NMLS# ${args.lo.nmls_id}` : 'NMLS ID on file';
  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:32px 20px;color:#0F1D2E;">
      <p>Hi ${args.partner.first_name},</p>
      <p style="line-height:1.6;">${bodyFor(args.type, args.borrowerName, loName)}</p>
      <p style="margin-top:24px;">Warm regards,<br/><strong>${loName}</strong></p>
      <p style="margin-top:28px;color:#9A9AA0;font-size:12px;line-height:1.5;">
        ${loName}, ${nmls}. This is a relationship update regarding a client you referred and is
        not an advertisement for a specific loan product, rate, or term. Equal Housing Lender.
      </p>
    </div>`;

  let sent = false;
  let messageId: string | undefined;
  if (process.env.RESEND_API_KEY) {
    try {
      const { sendCompliantEmail } = await import('@/lib/resend');
      const res = await sendCompliantEmail({
        to: args.partner.email,
        recipientEmail: args.partner.email,
        subject: SUBJECTS[args.type],
        html,
        orgId: args.orgId,
      });
      messageId = res?.id;
      sent = true;
    } catch {
      sent = false;
    }
  }

  // Audit every attempt (sent or gated) + advance the relationship recency.
  await sb.from('partner_update_emails').insert({
    org_id: args.orgId,
    partner_id: args.partner.id,
    lead_id: args.leadId ?? null,
    update_type: args.type,
    resend_message_id: messageId ?? null,
  });
  await sb.from('referral_partners').update({ last_outreach_at: new Date().toISOString() }).eq('id', args.partner.id).eq('org_id', args.orgId);

  return { sent };
}
