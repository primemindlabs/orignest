/**
 * Phase 40.2 — weekly ATTOM realtor-production sync (cron-callable).
 * GATED: ATTOM_API_KEY is not set, so this returns 501 — no fake production data.
 * When ATTOM is connected, fetch agent snapshots per org's target zips, upsert
 * realtors, and recompute partnership scores. Realtors can be added manually
 * meanwhile (POST /api/realtors), and scoring works on that data.
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
    return NextResponse.json(
      { error: 'attom_not_configured', message: 'ATTOM_API_KEY is required to sync MLS realtor production data.' },
      { status: 501 }
    );
  }
  // TODO(attom): per org with target zips → ATTOM agent snapshot → upsert realtors
  // (UNIQUE org_id,mls_agent_id) → computePartnershipScore. Requires ATTOM access.
  return NextResponse.json({ ok: true, synced: 0, note: 'ATTOM configured; agent-snapshot fetch pending implementation.' });
}
