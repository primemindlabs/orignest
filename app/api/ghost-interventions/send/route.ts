// Phase 85 — send a reviewed ghost-intervention SMS. TCPA-gated, no exceptions.
//
// Server enforces TWO gates before anything is transmitted:
//   1. tcpa_acknowledged === true  (the LO's explicit review/attestation)  -> 422 if not
//   2. the borrower has SMS consent on file (leads.sms_consent === true)    -> 422 if not
// Only then is the send recorded and (if Twilio is configured) transmitted. Without Twilio
// configured it is recorded as reviewed-but-not-transmitted — never silently "sent".

import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await getOrgContext();
    if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      intervention_id?: string; message?: string; tcpa_acknowledged?: boolean;
    };

    // Gate 1 — hard rejection without explicit acknowledgement.
    if (body.tcpa_acknowledged !== true) {
      return NextResponse.json({ error: 'TCPA acknowledgement required' }, { status: 422 });
    }
    if (!body.intervention_id) return NextResponse.json({ error: 'intervention_id required' }, { status: 400 });
    const message = (body.message ?? '').trim();
    if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 });

    const sb = createAdminClient();

    const { data: intervention } = await sb
      .from('ghost_interventions')
      .select('id, lead_id, sent_at')
      .eq('id', body.intervention_id)
      .eq('org_id', orgId)
      .maybeSingle();
    if (!intervention) return NextResponse.json({ error: 'Intervention not found' }, { status: 404 });
    if (intervention.sent_at) return NextResponse.json({ error: 'Already sent' }, { status: 409 });

    const { data: lead } = await sb
      .from('leads')
      .select('id, phone, sms_consent, sms_opt_out')
      .eq('id', intervention.lead_id)
      .eq('org_id', orgId)
      .maybeSingle();
    if (!lead) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

    // Gate 2 — system-of-record consent check (independent of the LO checkbox).
    if (lead.sms_consent !== true || lead.sms_opt_out === true) {
      return NextResponse.json(
        { error: 'No SMS consent on file for this borrower (or they have opted out). Cannot send.' },
        { status: 422 },
      );
    }

    const { data: caller } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();

    // Resolve a sending number (gated). If Twilio isn't configured, record-only.
    const { data: fromNumber } = await sb
      .from('twilio_numbers')
      .select('phone_number')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    const from = fromNumber?.phone_number || process.env.DEFAULT_TWILIO_NUMBER || '';
    const twilioReady = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && from && lead.phone);

    let transmitted = false;
    let transmitError: string | null = null;
    if (twilioReady) {
      try {
        const twilio = (await import('twilio')).default;
        const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
        await client.messages.create({ to: lead.phone as string, from, body: message });
        transmitted = true;
      } catch (e) {
        transmitError = e instanceof Error ? e.message : 'send failed';
      }
    }

    // Record the reviewed send regardless of transmission (audit trail).
    await sb
      .from('ghost_interventions')
      .update({
        edited_message: message,
        tcpa_acknowledged: true,
        sent_at: new Date().toISOString(),
        sent_by: (caller?.id as string | undefined) ?? null,
        transmitted,
      })
      .eq('id', intervention.id);

    return NextResponse.json({
      ok: true,
      transmitted,
      reason: transmitted ? null : transmitError ?? 'SMS sending is not configured — message recorded for review, not transmitted.',
    });
  } catch (err) {
    console.error('[ghost-interventions send]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
