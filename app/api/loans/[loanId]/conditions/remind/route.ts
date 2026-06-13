// Phase 113 — TCPA-gated borrower reminder for OUTSTANDING conditions (gap-fill).
// SMS requires sms_consent + phone + not opted out; Twilio is record-only unless
// CAMPAIGNS_LIVE_SEND + creds (the app's pattern). Falls back to compliant email.
// Logged INSERT-only in condition_reminders.
import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendCompliantEmail } from '@/lib/resend';

const CLEARED = ['cleared', 'waived', 'satisfied'];
function twilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}
const liveSend = () => process.env.CAMPAIGNS_LIVE_SEND === 'true';

export async function POST(_req: Request, { params }: { params: { loanId: string } }) {
  const leadId = params.loanId;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();

  const { data: conditions } = await sb
    .from('loan_conditions')
    .select('id, status')
    .eq('lead_id', leadId)
    .eq('org_id', orgId);
  const outstanding = (conditions ?? []).filter((c) => !CLEARED.includes((c.status as string) ?? ''));
  if (outstanding.length === 0) {
    return NextResponse.json({ message: 'No outstanding conditions', reminded: 0 });
  }

  const { data: lead } = await sb
    .from('leads')
    .select('first_name, phone, email, sms_consent')
    .eq('id', leadId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const firstName = (lead.first_name as string | null) ?? 'there';
  const count = outstanding.length;

  // Resolve (or mint) the borrower portal link.
  let token: string | null = null;
  const { data: tok } = await sb.from('borrower_portal_tokens').select('token').eq('org_id', orgId).eq('lead_id', leadId).maybeSingle();
  token = (tok?.token as string | null) ?? null;
  if (!token) {
    const { data: minted } = await sb.from('borrower_portal_tokens').insert({ org_id: orgId, lead_id: leadId }).select('token').maybeSingle();
    token = (minted?.token as string | null) ?? null;
  }
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.ashleyiq.com';
  const portalUrl = token ? `${baseUrl}/status/${token}` : baseUrl;

  // Channel selection — SMS only with consent; else compliant email.
  const phone = (lead.phone as string | null) ?? null;
  let channel: 'sms' | 'email' | null = null;
  if (lead.sms_consent && phone) {
    const { data: optOut } = await sb.from('sms_opt_outs').select('id').eq('org_id', orgId).eq('phone', phone).maybeSingle();
    if (!optOut) channel = 'sms';
  }
  if (!channel && lead.email) channel = 'email';
  if (!channel) {
    return NextResponse.json({ error: 'No consented SMS or email on file for this borrower' }, { status: 400 });
  }

  let externalId: string | null = null;
  try {
    if (channel === 'sms') {
      const body = `Hi ${firstName}, you have ${count} outstanding item${count === 1 ? '' : 's'} needed for your loan. See your portal: ${portalUrl} Reply STOP to opt out.`;
      if (twilioConfigured() && liveSend()) {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
        const msg = await client.messages.create({ body, from: process.env.TWILIO_PHONE_NUMBER!, to: phone! });
        externalId = msg.sid;
      } else {
        externalId = 'record_only';
      }
    } else {
      const res = await sendCompliantEmail({
        to: lead.email as string,
        subject: 'Items needed for your loan',
        text: `Hi ${firstName}, you have ${count} outstanding item${count === 1 ? '' : 's'} needed to keep your loan moving. Please see your portal: ${portalUrl}`,
        orgId,
        recipientEmail: lead.email as string,
        leadId,
      });
      externalId = res?.id ?? null;
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Send failed' }, { status: 500 });
  }

  await sb.from('condition_reminders').insert({
    org_id: orgId,
    lead_id: leadId,
    sent_by: profile?.id ?? null,
    outstanding_count: count,
    channel,
    external_message_id: externalId,
  });

  return NextResponse.json({ ok: true, reminded: count, channel });
}
