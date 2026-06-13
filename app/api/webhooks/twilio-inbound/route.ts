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

  // ── Phase 38.3 — SMS compliance keywords (STOP / HELP) ──────────────────────
  const keyword = body.trim().toUpperCase();
  const STOP = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];
  const HELP = ['HELP', 'INFO'];
  if (STOP.includes(keyword)) {
    if (leadId) {
      await sb.from('leads').update({ sms_opt_out: true }).eq('id', leadId).then(() => undefined, () => undefined);
      const { data: lr } = await sb.from('leads').select('email').eq('id', leadId).maybeSingle();
      if (lr?.email && orgId) {
        await sb.from('email_unsubscribes').upsert({ org_id: orgId, email: lr.email.toLowerCase(), lead_id: leadId, source: 'sms_stop' }, { onConflict: 'org_id,email', ignoreDuplicates: true }).then(() => undefined, () => undefined);
      }
      // Phase 97 — halt any in-progress 1003 abandon-recovery sequence for this
      // borrower and log the opt-out audit row.
      if (orgId) {
        await sb.from('application_sessions').update({ sms_consent: false }).eq('lead_id', leadId).is('completed_at', null).then(() => undefined, () => undefined);
        await sb.from('sms_opt_outs').insert({ org_id: orgId, lead_id: leadId, phone: from, source: 'twilio_webhook' }).then(() => undefined, () => undefined);
        // Phase 116 — granular preference + immutable consent audit.
        await sb.from('communication_preferences').upsert({ org_id: orgId, lead_id: leadId, lo_id: loId, sms_opted_in: false, updated_at: new Date().toISOString() }, { onConflict: 'org_id,lead_id' }).then(() => undefined, () => undefined);
        await sb.from('consent_audit_log').insert({ org_id: orgId, lead_id: leadId, lo_id: loId, event_type: 'sms_opt_out', channel: 'sms', source: 'sms_reply', old_value: 'true', new_value: 'false', consent_text: `Contact replied "${body.trim()}" to SMS` }).then(() => undefined, () => undefined);
      }
    }
    // Twilio's Advanced Opt-Out sends the standard confirmation; return empty TwiML.
    return twimlResponse();
  }
  // Phase 116 — START/UNSTOP re-opt-in (carrier keywords only; "YES" omitted to avoid
  // hijacking conversational replies).
  const START = ['START', 'UNSTOP'];
  if (START.includes(keyword)) {
    if (leadId && orgId) {
      await sb.from('leads').update({ sms_consent: true }).eq('id', leadId).then(() => undefined, () => undefined);
      await sb.from('sms_opt_outs').delete().eq('org_id', orgId).eq('phone', from).then(() => undefined, () => undefined);
      await sb.from('communication_preferences').upsert({ org_id: orgId, lead_id: leadId, lo_id: loId, sms_opted_in: true, updated_at: new Date().toISOString() }, { onConflict: 'org_id,lead_id' }).then(() => undefined, () => undefined);
      await sb.from('consent_audit_log').insert({ org_id: orgId, lead_id: leadId, lo_id: loId, event_type: 'sms_opt_in', channel: 'sms', source: 'sms_reply', old_value: 'false', new_value: 'true', consent_text: `Contact replied "${body.trim()}" to SMS` }).then(() => undefined, () => undefined);
    }
    return twimlResponse();
  }
  if (HELP.includes(keyword)) {
    return new NextResponse('<Response><Message>Reply STOP to unsubscribe. For help, contact your loan officer.</Message></Response>', { status: 200, headers: { 'Content-Type': 'text/xml' } });
  }

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

        // Promoter (9-10): fire the social-proof pipeline, which generates
        // social captions for LO review AND sends the Google review request SMS
        // (using the org's configured review URL). Centralizing the review SMS
        // here avoids sending it twice.
        if (npsScore >= 9) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL;
          if (appUrl) {
            await fetch(`${appUrl}/api/automations/social-proof`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lead_id: leadId, org_id: orgId, score: npsScore }),
            }).catch((err: Error) => console.error('[twilio-inbound] social-proof pipeline failed:', err.message));
          }

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
