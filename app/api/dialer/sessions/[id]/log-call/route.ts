/**
 * Phase 33.4/33.8 — log a completed call + disposition; advance the queue.
 * dialer_calls is the audit record (no delete). Feeds Velocity (30.6) + Outcome
 * Learning (30.4) and writes a timeline activity. A DNC disposition flags the lead.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DISPOSITIONS = ['connected', 'voicemail', 'no_answer', 'busy', 'wrong_number', 'not_interested', 'callback_requested', 'do_not_call'];

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    lead_id?: string; disposition?: string; duration_seconds?: number; voicemail_dropped?: boolean;
    twilio_call_sid?: string; phone_number_called?: string; tcpa_check_passed?: boolean; tcpa_check_result?: unknown;
  };
  if (!body.lead_id || !DISPOSITIONS.includes(body.disposition ?? '')) {
    return NextResponse.json({ error: 'lead_id and a valid disposition are required' }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data: session } = await sb.from('dialer_sessions').select('id').eq('id', params.id).eq('org_id', orgId).maybeSingle();
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const connected = body.disposition === 'connected';
  const dur = Number(body.duration_seconds) || 0;

  const { data: call, error } = await sb
    .from('dialer_calls')
    .insert({
      session_id: params.id,
      org_id: orgId,
      lead_id: body.lead_id,
      lo_id: userId,
      twilio_call_sid: body.twilio_call_sid ?? null,
      phone_number_called: body.phone_number_called ?? '',
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      answered_at: connected ? new Date().toISOString() : null,
      duration_seconds: dur,
      disposition: body.disposition,
      voicemail_dropped: Boolean(body.voicemail_dropped),
      tcpa_check_passed: Boolean(body.tcpa_check_passed),
      tcpa_check_result: body.tcpa_check_result ?? null,
    })
    .select('id')
    .single();
  if (error) {
    console.error('[log-call] insert failed', error);
    return NextResponse.json({ error: 'Failed to log call' }, { status: 500 });
  }

  // Advance the queue item.
  await sb.from('dialer_queue_items').update({ status: 'completed', call_id: call.id }).eq('session_id', params.id).eq('lead_id', body.lead_id);

  // Bump session counters.
  const { data: s } = await sb.from('dialer_sessions').select('total_calls, connected_calls, voicemails_dropped, total_talk_seconds').eq('id', params.id).maybeSingle();
  await sb.from('dialer_sessions').update({
    total_calls: (s?.total_calls ?? 0) + 1,
    connected_calls: (s?.connected_calls ?? 0) + (connected ? 1 : 0),
    voicemails_dropped: (s?.voicemails_dropped ?? 0) + (body.voicemail_dropped ? 1 : 0),
    total_talk_seconds: (s?.total_talk_seconds ?? 0) + dur,
  }).eq('id', params.id);

  // A do_not_call disposition flags the lead immediately.
  if (body.disposition === 'do_not_call') {
    await sb.from('leads').update({ dnc_flagged: true, dnc_flagged_at: new Date().toISOString(), dnc_flagged_by: userId }).eq('id', body.lead_id).eq('org_id', orgId);
  }

  // Timeline activity (real lead_activities columns: action/description/metadata).
  await sb.from('lead_activities').insert({
    lead_id: body.lead_id,
    org_id: orgId,
    action: 'dialer_call',
    description: `Dialer call — ${(body.disposition ?? '').replace(/_/g, ' ')}`,
    metadata: { call_id: call.id, disposition: body.disposition, duration_seconds: dur },
  }).then(() => undefined, () => undefined);

  return NextResponse.json({ ok: true, call_id: call.id });
}
