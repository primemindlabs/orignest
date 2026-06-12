import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import twilio from 'twilio';
import { createClient } from '@/lib/supabase/server';
import { sendCompliantEmail } from '@/lib/resend';

interface SendBody {
  leadId: string | null;
  channel: 'sms' | 'email';
  body: string;
  toAddress: string;
  subject?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: SendBody;
  try {
    payload = (await req.json()) as SendBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { leadId, channel, body, toAddress, subject } = payload;

  if (!channel || !body?.trim() || !toAddress) {
    return NextResponse.json({ error: 'channel, body, and toAddress are required' }, { status: 400 });
  }

  const sb = createClient();

  // ── Resolve org UUID ───────────────────────────────────────────────────────
  const { data: org } = await sb
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', orgId)
    .maybeSingle();

  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  // ── Resolve profile ────────────────────────────────────────────────────────
  const { data: profile } = await sb
    .from('profiles')
    .select('id, first_name, last_name, email')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // ── TCPA consent check for SMS ─────────────────────────────────────────────
  if (channel === 'sms' && leadId) {
    const { data: lead } = await sb
      .from('leads')
      .select('sms_consent, first_name, last_name')
      .eq('id', leadId)
      .eq('org_id', org.id)
      .maybeSingle();

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (!lead.sms_consent) {
      return NextResponse.json(
        { error: 'SMS consent not on file for this borrower. Obtain written TCPA consent before sending SMS.' },
        { status: 403 }
      );
    }
  }

  // ── Send via channel ───────────────────────────────────────────────────────
  let externalMessageId: string | undefined;

  if (channel === 'sms') {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return NextResponse.json(
        { error: 'Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.' },
        { status: 500 }
      );
    }

    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({
      to: toAddress,
      from: fromNumber,
      body: body.trim(),
    });
    externalMessageId = message.sid;
  } else if (channel === 'email') {
    const emailResult = await sendCompliantEmail({
      to: toAddress,
      recipientEmail: toAddress,
      orgId: org.id,
      leadId,
      subject: subject ?? `Message from ${profile.first_name} ${profile.last_name}`,
      html: `<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:32px 20px;color:#1c1c1e;line-height:1.6;">${body.replace(/\n/g, '<br/>')}</div>`,
    });
    externalMessageId = emailResult?.id;
  }

  // ── Log to communications ──────────────────────────────────────────────────
  if (leadId) {
    await sb.from('communications').insert({
      lead_id: leadId,
      org_id: org.id,
      sender_id: profile.id,
      channel,
      direction: 'outbound',
      subject: subject ?? null,
      body: body.trim(),
      consent_status_at_send: channel === 'email' ? true : true,
      resend_message_id: externalMessageId ?? null,
      sent_at: new Date().toISOString(),
    });

    // ── Mark inbound thread as replied ─────────────────────────────────────
    await sb
      .from('inbound_messages')
      .update({ replied_at: new Date().toISOString() })
      .eq('lead_id', leadId)
      .eq('channel', channel)
      .is('replied_at', null);
  }

  return NextResponse.json({ ok: true, messageId: externalMessageId });
}
