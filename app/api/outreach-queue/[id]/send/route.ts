// Phase 102 — dispatch an approved outreach item.
//
// Hard server-side gates (independent of UI state):
//   1. item belongs to the caller's org
//   2. status === 'approved'
//   3. SMS only: tcpa_acknowledged === true  → else 403 TCPA_NOT_ACKNOWLEDGED
//   4. SMS only: phone not on sms_opt_outs    → else 'failed'
//
// SMS send is Twilio-gated (record-only when creds / CAMPAIGNS_LIVE_SEND absent),
// mirroring the rest of the app. Email goes through sendCompliantEmail (Resend, live;
// injects the CAN-SPAM footer and throws if the physical address is unconfigured).
import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendCompliantEmail } from '@/lib/resend';
import { notify } from '@/lib/notifications/notify';
import { EVENT_TYPE_LABEL, type OutreachEventType } from '@/lib/outreach/templates';

type Ctx = { params: Promise<{ id: string }> };

const SUBJECTS: Record<OutreachEventType, string> = {
  birthday: 'Happy Birthday!',
  home_anniversary: 'Happy Home Anniversary!',
  loan_anniversary: 'A Milestone Worth Celebrating',
  realtor_anniversary: 'Celebrating Our Partnership',
};

function twilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}
const liveSend = () => process.env.CAMPAIGNS_LIVE_SEND === 'true';

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: item } = await sb
    .from('outreach_queue')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (item.status !== 'approved') {
    return NextResponse.json({ error: 'Item must be approved before sending' }, { status: 400 });
  }
  if (item.channel === 'sms' && !item.tcpa_acknowledged) {
    return NextResponse.json({ error: 'TCPA_NOT_ACKNOWLEDGED' }, { status: 403 });
  }

  // Resolve contact + event label.
  const isRealtor = !!item.realtor_id;
  const contact = isRealtor
    ? (await sb.from('realtors').select('first_name, last_name, phone, email').eq('id', item.realtor_id).maybeSingle()).data
    : (await sb.from('leads').select('first_name, phone, email').eq('id', item.lead_id).maybeSingle()).data;
  const { data: ev } = await sb.from('life_events').select('event_type').eq('id', item.life_event_id).maybeSingle();
  const eventType = (ev?.event_type as OutreachEventType) ?? 'birthday';
  const firstName = isRealtor
    ? `${(contact as any)?.first_name ?? ''} ${(contact as any)?.last_name ?? ''}`.trim() || 'there'
    : ((contact as any)?.first_name as string | null) ?? 'there';

  const fail = async (reason: string, code = 500) => {
    await sb
      .from('outreach_queue')
      .update({ status: 'failed', failure_reason: reason, failed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', orgId);
    return NextResponse.json({ error: reason }, { status: code });
  };

  try {
    if (item.channel === 'sms') {
      const phone = (contact as any)?.phone as string | null;
      if (!phone) return fail('No phone on contact', 400);

      // Opt-out guard.
      const { data: optOut } = await sb
        .from('sms_opt_outs')
        .select('id')
        .eq('org_id', orgId)
        .eq('phone', phone)
        .maybeSingle();
      if (optOut) return fail('Recipient has opted out of SMS', 400);

      let sid = 'record_only';
      if (twilioConfigured() && liveSend()) {
        const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
        const msg = await client.messages.create({
          body: item.message_draft,
          from: process.env.TWILIO_PHONE_NUMBER!,
          to: phone,
        });
        sid = msg.sid;
      }
      await sb
        .from('outreach_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString(), twilio_message_sid: sid })
        .eq('id', id)
        .eq('org_id', orgId);
    } else {
      const email = (contact as any)?.email as string | null;
      if (!email) return fail('No email on contact', 400);
      const res = await sendCompliantEmail({
        to: email,
        subject: SUBJECTS[eventType],
        text: item.message_draft,
        orgId,
        recipientEmail: email,
        leadId: (item.lead_id as string | null) ?? null,
      });
      await sb
        .from('outreach_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString(), resend_message_id: res?.id ?? null })
        .eq('id', id)
        .eq('org_id', orgId);
    }

    // Best-effort notification on the bell.
    if (item.user_id) {
      await notify(sb, {
        orgId,
        userId: item.user_id as string,
        type: 'system',
        title: `${EVENT_TYPE_LABEL[eventType]} outreach sent to ${firstName}`,
        body: `${(item.channel as string).toUpperCase()} sent via ${item.channel === 'sms' ? 'Twilio' : 'Resend'}`,
        link: '/outreach?status=sent',
      });
    }

    return NextResponse.json({ id, status: 'sent', channel: item.channel });
  } catch (e: any) {
    return fail(e?.message ?? 'Send failed', 500);
  }
}
