import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { createAdminClient } from '@/lib/supabase/admin';

// Twilio sends POST with application/x-www-form-urlencoded body.
// No Clerk auth — validated by Twilio signature.

export const runtime = 'nodejs';

function twimlResponse(): NextResponse {
  return new NextResponse('<Response/>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Validate Twilio signature ──────────────────────────────────────────────
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error('[twilio-inbound] TWILIO_AUTH_TOKEN not set');
    return new NextResponse('Server misconfiguration', { status: 500 });
  }

  const twilioSignature = req.headers.get('X-Twilio-Signature') ?? '';
  const url = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/twilio-inbound`
    : req.url;

  const rawBody = await req.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  const isValid = twilio.validateRequest(authToken, twilioSignature, url, params);
  if (!isValid) {
    console.warn('[twilio-inbound] Invalid Twilio signature');
    return new NextResponse('Forbidden', { status: 403 });
  }

  const from: string = params['From'] ?? '';
  const to: string = params['To'] ?? '';
  const body: string = params['Body'] ?? '';
  const numMedia = parseInt(params['NumMedia'] ?? '0', 10);

  if (!from || !body) {
    return twimlResponse();
  }

  const sb = createAdminClient();

  // ── Find org by the Twilio number (to) ────────────────────────────────────
  // We look for the phone in profiles (LO's assigned Twilio number) or org settings.
  // Simplified: match lead by phone number, derive org from lead.
  const cleanPhone = from.replace(/\D/g, '');

  const { data: matchedLead } = await sb
    .from('leads')
    .select('id, org_id, assigned_to, first_name, last_name')
    .or(`phone.eq.${from},phone.eq.+${cleanPhone},phone.eq.${cleanPhone}`)
    .limit(1)
    .maybeSingle();

  const orgId: string | null = matchedLead?.org_id ?? null;
  const leadId: string | null = matchedLead?.id ?? null;
  const loId: string | null = matchedLead?.assigned_to ?? null;

  if (!orgId) {
    // Unmatched number — still log with null org is not allowed by schema.
    // Return TwiML and skip DB insert.
    console.warn('[twilio-inbound] No org found for To:', to);
    return twimlResponse();
  }

  // ── Insert inbound message ─────────────────────────────────────────────────
  const { data: inserted, error: insertError } = await sb
    .from('inbound_messages')
    .insert({
      org_id: orgId,
      lead_id: leadId,
      channel: 'sms',
      from_address: from,
      to_address: to,
      body,
      raw_payload: params as Record<string, unknown>,
      lo_id: loId,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[twilio-inbound] DB insert error:', insertError.message);
  }

  // ── Log to communications table ────────────────────────────────────────────
  if (leadId && inserted?.id) {
    await sb.from('communications').insert({
      lead_id: leadId,
      org_id: orgId,
      sender_id: loId ?? (await sb.from('profiles').select('id').eq('org_id', orgId).limit(1).maybeSingle().then(({ data }) => data?.id ?? '')),
      channel: 'sms',
      direction: 'inbound',
      body,
      consent_status_at_send: true,
      sent_at: new Date().toISOString(),
    });
  }

  // ── Create task for LO ─────────────────────────────────────────────────────
  if (leadId && orgId) {
    const contactName = matchedLead
      ? `${matchedLead.first_name} ${matchedLead.last_name}`
      : from;

    await sb.from('lead_tasks').insert({
      lead_id: leadId,
      org_id: orgId,
      assigned_to: loId,
      title: `Reply to SMS from ${contactName}`,
      description: `Inbound SMS: "${body.slice(0, 120)}${body.length > 120 ? '…' : ''}"`,
      priority: 'high',
      completed: false,
      due_date: null,
    });
  }

  // ── NPS response detection ─────────────────────────────────────────────────
  if (leadId && orgId) {
    const scoreMatch = body.trim().match(/^([1-9]|10)$/);
    if (scoreMatch) {
      const npsScore = parseInt(scoreMatch[1], 10);

      const { data: pendingNps } = await sb
        .from('nps_responses')
        .select('id, lo_id')
        .eq('lead_id', leadId)
        .is('score', null)
        .maybeSingle();

      if (pendingNps) {
        await sb
          .from('nps_responses')
          .update({
            score: npsScore,
            responded_at: new Date().toISOString(),
          })
          .eq('id', pendingNps.id);

        // Auto-reply only for promoters (9-10)
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER;

        if (npsScore >= 9 && accountSid && authToken && fromNumber) {
          // TODO: replace with org's actual Google review link from settings
          const reviewLink = process.env.GOOGLE_REVIEW_LINK ?? 'https://g.page/r/review';
          const thankYouMsg = `Thank you so much! We'd love if you shared your experience: ${reviewLink} 🙏`;

          const { default: twilioClient } = await import('twilio');
          const client = twilioClient(accountSid, authToken);
          await client.messages.create({ to: from, from: fromNumber, body: thankYouMsg });

          await sb
            .from('nps_responses')
            .update({ review_requested_at: new Date().toISOString() })
            .eq('id', pendingNps.id);
        }

        // Notify LO via task for detractors
        if (npsScore <= 6 && pendingNps.lo_id) {
          const { data: leadInfo } = await sb
            .from('leads')
            .select('first_name, last_name')
            .eq('id', leadId)
            .maybeSingle();

          await sb.from('lead_tasks').insert({
            lead_id: leadId,
            org_id: orgId,
            assigned_to: pendingNps.lo_id,
            title: `Low NPS score: ${leadInfo?.first_name ?? ''} ${leadInfo?.last_name ?? ''} gave ${npsScore}/10`,
            description: `This borrower rated their experience ${npsScore}/10. Follow up personally to understand their concerns.`,
            priority: 'high',
            task_type: 'follow_up',
            due_date: new Date().toISOString(),
          });
        }
      }
    }
  }

  // ── Media attachments note ─────────────────────────────────────────────────
  if (numMedia > 0 && leadId) {
    const mediaUrls = Array.from({ length: numMedia }, (_, i) => params[`MediaUrl${i}`]).filter(Boolean);
    await sb.from('lead_activities').insert({
      lead_id: leadId,
      org_id: orgId ?? '',
      actor_id: null,
      action: 'sms_media_received',
      description: `Received ${numMedia} media file(s) via SMS`,
      metadata: { media_urls: mediaUrls } as Record<string, unknown>,
    });
  }

  return twimlResponse();
}
