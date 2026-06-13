/**
 * Phase 99 — weekly funnel snapshot calculator (CRON_SECRET-gated).
 * For every (org, LO) with stage transitions in the last 180d, compute each period
 * and INSERT a conversion_funnel_snapshots row (period_end = today). Snapshots are
 * INSERT-only; the unique index keeps a same-week re-run from duplicating.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeFunnel } from '@/lib/funnel/compute';
import { FUNNEL_STAGES } from '@/lib/funnel/stages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PERIODS = [30, 60, 90, 180];
const DAY = 86_400_000;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createAdminClient();
  const cutoff = new Date(Date.now() - 180 * DAY).toISOString();
  const { data: rows } = await sb
    .from('stage_transitions')
    .select('org_id, lo_id')
    .gte('transitioned_at', cutoff)
    .not('lo_id', 'is', null)
    .limit(100000);

  const pairs = new Map<string, { org_id: string; lo_id: string }>();
  for (const r of rows ?? []) {
    if (!r.org_id || !r.lo_id) continue;
    pairs.set(`${r.org_id}|${r.lo_id}`, { org_id: r.org_id as string, lo_id: r.lo_id as string });
  }

  const periodEnd = new Date().toISOString().split('T')[0];
  let snapshotsWritten = 0;

  for (const { org_id, lo_id } of Array.from(pairs.values())) {
    for (const periodDays of PERIODS) {
      const f = await computeFunnel(sb, org_id, lo_id, periodDays);
      const stageData: Record<string, unknown> = {};
      for (const stage of FUNNEL_STAGES) {
        const s = f.stages.find((x) => x.name === stage);
        if (!s) continue;
        stageData[stage] = {
          count: s.entered_count,
          entered_count: s.entered_count,
          exited_count: stage === 'closed' ? null : s.exited_count,
          avg_days_in_stage: s.avg_days_in_stage,
          conversion_pct: s.conversion_pct,
        };
      }
      const { error } = await sb.from('conversion_funnel_snapshots').insert({
        org_id, lo_id,
        period_days: periodDays,
        period_end: periodEnd,
        stage_data: stageData,
        bottleneck_stage: f.bottleneck_stage,
        bottleneck_conversion_pct: f.bottleneck_conversion_pct,
      });
      if (!error) snapshotsWritten += 1; // unique-violation re-runs ignored
    }
  }

  return NextResponse.json({ ok: true, processed_users: pairs.size, snapshots_written: snapshotsWritten });
}

// Vercel Cron invokes via GET with the CRON_SECRET bearer; delegate to POST.
export const GET = POST;
