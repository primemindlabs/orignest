import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import twilio from 'twilio';

// POST /api/automations/nps
// Sends a post-close NPS survey to a borrower via SMS.
// Called automatically by post-close retention function at 14 days post-close,
// or manually by LO from reviews page.

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let leadId: string;
  try {
    const body = (await req.json()) as { leadId: string };
    leadId = body.leadId;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!leadId) {
    return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
  }

  const sb = createClient();
  const sbAdmin = createAdminClient();

  // ── Resolve org UUID ───────────────────────────────────────────────────────
  const { data: org } = await sb
    .from('organizations')
    .select('id, name')
    .eq('clerk_org_id', orgId)
    .maybeSingle();

  if (!org) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  // ── Resolve profile (sending LO) ───────────────────────────────────────────
  const { data: profile } = await sb
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // ── Get lead ───────────────────────────────────────────────────────────────
  const { data: lead } = await sb
    .from('leads')
    .select('id, first_name, last_name, phone, sms_consent, stage')
    .eq('id', leadId)
    .eq('org_id', org.id)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  if (!lead.sms_consent) {
    return NextResponse.json(
      { error: 'SMS consent not on file. Cannot send NPS survey.' },
      { status: 403 }
    );
  }

  if (!lead.phone) {
    return NextResponse.json(
      { error: 'No phone number on file for this lead.' },
      { status: 400 }
    );
  }

  // ── Check for existing NPS request ─────────────────────────────────────────
  const { data: existing } = await sbAdmin
    .from('nps_responses')
    .select('id')
    .eq('lead_id', leadId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'NPS survey already sent for this lead.' }, { status: 409 });
  }

  // ── Send SMS ───────────────────────────────────────────────────────────────
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  const loName = `${profile.first_name} ${profile.last_name}`;
  const message = `Hi ${lead.first_name}! It was a pleasure helping you close your loan. On a scale of 1-10, how was your experience working with ${loName}? Just reply with a number!`;

  if (!accountSid || !authToken || !fromNumber) {
    // TODO: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER env vars
    console.warn('[nps] Twilio not configured — logging NPS request without SMS');
  } else {
    const client = twilio(accountSid, authToken);
    await client.messages.create({
      to: lead.phone,
      from: fromNumber,
      body: message,
    });
  }

  // ── Create NPS response record ─────────────────────────────────────────────
  const { error: insertError } = await sbAdmin.from('nps_responses').insert({
    org_id: org.id,
    lead_id: leadId,
    lo_id: profile.id,
  });

  if (insertError) {
    console.error('[nps] DB insert error:', insertError.message);
    return NextResponse.json({ error: 'Failed to record NPS request' }, { status: 500 });
  }

  // ── Log activity ───────────────────────────────────────────────────────────
  await sbAdmin.from('lead_activities').insert({
    lead_id: leadId,
    org_id: org.id,
    actor_id: profile.id,
    action: 'nps_sent',
    description: `NPS survey sent to ${lead.first_name} ${lead.last_name}`,
    metadata: { channel: 'sms', lo_name: loName },
  });

  return NextResponse.json({ ok: true });
}
