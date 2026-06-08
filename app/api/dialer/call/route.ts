import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import twilio from 'twilio';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { lead_id, to_phone } = (await req.json()) as { lead_id?: string; to_phone?: string };
  if (!to_phone) return NextResponse.json({ error: 'Phone number required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: org } = await sb.from('organizations').select('id').eq('clerk_org_id', orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).eq('org_id', org.id).maybeSingle();

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    // TODO: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to enable calling.
    return NextResponse.json(
      { error: 'Calling is not configured yet. Add your Twilio credentials to enable the dialer.' },
      { status: 503 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const client = twilio(accountSid, authToken);

  let callSid: string;
  try {
    const call = await client.calls.create({
      to: to_phone,
      from: fromNumber,
      url: `${appUrl}/api/webhooks/twilio-inbound`,
      statusCallback: `${appUrl}/api/dialer/status`,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['completed', 'no-answer', 'busy', 'failed'],
    });
    callSid = call.sid;
  } catch (err) {
    console.error('[dialer] Twilio call failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Failed to place call' }, { status: 500 });
  }

  await sb.from('call_log').insert({
    org_id: org.id,
    user_id: profile?.id ?? null,
    lead_id: lead_id || null,
    direction: 'outbound',
    phone_from: fromNumber,
    phone_to: to_phone,
    status: 'initiated',
    twilio_call_sid: callSid,
  });

  return NextResponse.json({ success: true, call_sid: callSid });
}
