/**
 * Phase 145 — Speed-to-Lead cron. Finds brand-new, SMS-consented leads owned by an
 * LO who has speed-to-lead enabled and fires Ashley's first touch. Runs every minute
 * so the opener lands within ~60s of the lead arriving. CRON_SECRET bearer; GET+POST.
 *
 * Idempotent: initiateConciergeFirstTouch skips any lead that already has a
 * conversation, so overlapping runs never double-open or double-send.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { initiateConciergeFirstTouch } from '@/lib/concierge/firstTouch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LOOKBACK_MIN = 15;   // window > cron interval so a missed minute still gets picked up
const MAX_FIRES = 30;      // safety cap per run

async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sb = createAdminClient();

  // LOs (and org-default rows) with speed-to-lead on.
  const { data: eligible } = await sb.from('ai_concierge_settings')
    .select('org_id, lo_id').eq('enabled', true).eq('speed_to_lead', true);
  if (!eligible?.length) return NextResponse.json({ ok: true, fired: 0, reason: 'no speed-to-lead LOs' });

  const since = new Date(Date.now() - LOOKBACK_MIN * 60_000).toISOString();
  const fired: { lead_id: string; ok: boolean; reason?: string; sent?: boolean }[] = [];

  for (const row of eligible) {
    if (fired.length >= MAX_FIRES) break;
    let q = sb.from('leads')
      .select('id, assigned_to')
      .eq('org_id', row.org_id as string)
      .eq('sms_consent', true)
      .not('phone', 'is', null)
      .gte('created_at', since)
      .limit(MAX_FIRES);
    if (row.lo_id) q = q.eq('assigned_to', row.lo_id as string);  // lo-specific row → that LO's leads
    const { data: leads } = await q;

    for (const lead of leads ?? []) {
      if (fired.length >= MAX_FIRES) break;
      try {
        const r = await initiateConciergeFirstTouch(sb, { orgId: row.org_id as string, leadId: lead.id as string, loId: (lead.assigned_to as string | null) ?? (row.lo_id as string | null) });
        if (r.ok) fired.push({ lead_id: lead.id as string, ok: true, sent: r.sent });
      } catch (e) {
        fired.push({ lead_id: lead.id as string, ok: false, reason: (e as Error).message });
      }
    }
  }

  return NextResponse.json({ ok: true, fired: fired.length, results: fired });
}

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }
