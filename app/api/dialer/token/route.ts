/**
 * Phase 33.5 — Twilio Client (WebRTC) access token for the in-browser dialer.
 *
 * GATED: requires the WebRTC dialer creds (TWILIO_API_KEY, TWILIO_API_SECRET,
 * TWILIO_TWIML_APP_SID) in addition to the account SID. The project has the
 * account SID/auth token (for SMS) but not these — so this returns 501 until
 * they're set. The rest of the dialer (TCPA, queue, disposition logging,
 * coaching, summaries) works without WebRTC.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import twilio from 'twilio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function webrtcConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_API_KEY && process.env.TWILIO_API_SECRET && process.env.TWILIO_TWIML_APP_SID);
}

export async function GET() {
  const { userId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!webrtcConfigured()) {
    return NextResponse.json(
      { error: 'webrtc_not_configured', message: 'In-browser calling needs TWILIO_API_KEY, TWILIO_API_SECRET, and TWILIO_TWIML_APP_SID.' },
      { status: 501 }
    );
  }

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;
  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_API_KEY!,
    process.env.TWILIO_API_SECRET!,
    { identity: userId, ttl: 3600 }
  );
  token.addGrant(new VoiceGrant({ outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID!, incomingAllow: false }));
  return NextResponse.json({ token: token.toJwt() });
}
