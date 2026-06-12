// Phase 87 — Twilio voicemail recording webhook. INERT without Twilio configured, but the
// full speed-to-lead pipeline runs inline when creds exist:
//   insert call_records -> Deepgram transcribe -> Ashley SMS (Haiku) -> Twilio send ->
//   update record -> notify the LO (notifications + realtime toast).
// Returns 200 quickly; all external steps degrade gracefully if a provider is unconfigured.

import { createAdminClient } from '@/lib/supabase/admin';
import { transcribeWithDeepgram } from '@/lib/voicemail/deepgram';
import { generateAshleySMS } from '@/lib/voicemail/ashleySms';
import { notify } from '@/lib/notifications/notify';

export const runtime = 'nodejs';

function normalizePhone(p: string): string {
  return (p || '').replace(/\D/g, '').slice(-10);
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const recordingUrl = (form.get('RecordingUrl') as string) || '';
    const callerNumber = (form.get('From') as string) || '';
    const toNumber = (form.get('To') as string) || '';
    const callSid = (form.get('CallSid') as string) || (form.get('RecordingSid') as string) || '';
    const durationRaw = (form.get('RecordingDuration') as string) || '';

    if (!toNumber) return new Response('OK', { status: 200 });

    const sb = createAdminClient();

    // Resolve the LO from the dialed Twilio number.
    const { data: tn } = await sb
      .from('twilio_numbers')
      .select('user_id, org_id')
      .eq('phone_number', toNumber)
      .maybeSingle();
    if (!tn?.org_id) return new Response('OK', { status: 200 }); // unknown number — accept, no-op

    const loId = tn.user_id as string | null;
    const orgId = tn.org_id as string;

    // Match the caller to an existing lead (org-scoped) by last-10 digits.
    const last10 = normalizePhone(callerNumber);
    let lead: { id: string; first_name: string | null; stage: string | null; phone: string | null } | null = null;
    if (last10) {
      const { data: leads } = await sb
        .from('leads')
        .select('id, first_name, stage, phone')
        .eq('org_id', orgId)
        .ilike('phone', `%${last10}%`)
        .limit(1);
      lead = leads?.[0] ?? null;
    }

    // Stub record immediately (idempotent on call SID).
    const { data: record } = await sb
      .from('call_records')
      .upsert(
        {
          org_id: orgId,
          user_id: loId,
          lead_id: lead?.id ?? null,
          caller_number: callerNumber,
          direction: 'inbound',
          duration_seconds: durationRaw ? parseInt(durationRaw, 10) : null,
          recording_url: recordingUrl || null,
          twilio_call_sid: callSid || null,
        },
        { onConflict: 'twilio_call_sid', ignoreDuplicates: false },
      )
      .select('id')
      .maybeSingle();

    const recordId = record?.id as string | undefined;

    // ── Pipeline (each step gated/graceful) ──────────────────────────────────────
    const start = Date.now();
    let transcript = '';
    let deepgramId: string | null = null;
    if (recordingUrl) {
      const dg = await transcribeWithDeepgram(recordingUrl);
      if (dg) { transcript = dg.transcript; deepgramId = dg.requestId; }
    }

    const { data: lo } = loId
      ? await sb.from('profiles').select('first_name, last_name').eq('id', loId).maybeSingle()
      : { data: null };
    const loName = lo ? `${lo.first_name ?? ''} ${lo.last_name ?? ''}`.trim() || 'your loan officer' : 'your loan officer';

    const smsBody = await generateAshleySMS(transcript, lead, loName);

    // Send via Twilio (gated).
    let smsSent = false;
    const twilioReady = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && toNumber && callerNumber);
    if (twilioReady) {
      try {
        const twilio = (await import('twilio')).default;
        const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
        await client.messages.create({ to: callerNumber, from: toNumber, body: smsBody });
        smsSent = true;
      } catch (e) {
        console.error('[twilio-voicemail send]', e);
      }
    }

    const elapsed = Date.now() - start;

    if (recordId) {
      await sb
        .from('call_records')
        .update({
          transcript: transcript || null,
          deepgram_request_id: deepgramId,
          ashley_sms_sent: smsSent,
          ashley_sms_body: smsBody,
          ashley_sms_sent_at: smsSent ? new Date().toISOString() : null,
          pipeline_ms: elapsed,
        })
        .eq('id', recordId);
    }

    // Notify the LO (event store + realtime toast).
    if (loId) {
      const who = lead?.first_name ?? callerNumber;
      await notify(sb, {
        orgId,
        userId: loId,
        type: 'new_voicemail',
        title: `New voicemail from ${who}`,
        body: transcript ? transcript.slice(0, 100) + (transcript.length > 100 ? '…' : '') : 'New voicemail received.',
        link: `/voicemails${recordId ? `?call=${recordId}` : ''}`,
      });

      // Performance guard per spec: alert if the pipeline exceeded 90s.
      if (elapsed > 90_000) {
        await notify(sb, {
          orgId, userId: loId, type: 'system',
          title: 'Voicemail pipeline slow',
          body: `Speed-to-lead pipeline took ${Math.round(elapsed / 1000)}s (target <60s).`,
        });
      }
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('[twilio-voicemail]', err);
    return new Response('OK', { status: 200 }); // always 200 so Twilio doesn't retry-storm
  }
}
