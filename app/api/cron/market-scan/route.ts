/**
 * Phase 48.5 — weekly ATTOM market scan: discover all active agents in each org's
 * target zips and upsert realtor_market_profiles. GATED: ATTOM_API_KEY is not set,
 * so returns 501 — no fake agent data. Match scoring + the Discover UI work on
 * whatever profiles exist; this populates them once ATTOM is connected.
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.ATTOM_API_KEY) {
    return NextResponse.json({ error: 'attom_not_configured', message: 'ATTOM_API_KEY required to scan markets for agents.' }, { status: 501 });
  }
  // TODO(attom): per org target zips → ATTOM agent snapshot → upsert
  // realtor_market_profiles (UNIQUE attom_agent_id,org_id) → detect rising agents.
  return NextResponse.json({ ok: true, scanned: 0 });
}
