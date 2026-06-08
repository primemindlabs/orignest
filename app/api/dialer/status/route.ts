import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Twilio status callback — updates the call_log row by Call SID.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData();
  const callSid = formData.get('CallSid') as string | null;
  const callStatus = (formData.get('CallStatus') as string | null) ?? 'unknown';
  const callDuration = parseInt((formData.get('CallDuration') as string | null) ?? '0', 10) || 0;

  if (callSid) {
    const sb = createAdminClient();
    await sb
      .from('call_log')
      .update({ status: callStatus, duration_seconds: callDuration })
      .eq('twilio_call_sid', callSid);
  }

  return new NextResponse('', { status: 200 });
}
