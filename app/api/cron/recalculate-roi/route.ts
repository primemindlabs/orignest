/**
 * Phase 98 — weekly ROI snapshot recalculation (CRON_SECRET-gated).
 * For every (org, LO) with leads, recompute each period and INSERT immutable
 * roi_snapshots rows (period_end = today). The unique index keeps a re-run within
 * the same week from duplicating; roi_snapshots is INSERT-only (no upsert/update).
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeReferralROI } from '@/lib/analytics/aggregate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PERIODS = [30, 60, 90, 180];

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createAdminClient();
  // Distinct (org, LO) pairs that have leads.
  const { data: leadRows } = await sb.from('leads').select('org_id, assigned_to').not('assigned_to', 'is', null).limit(100000);
  const pairs = new Map<string, { org_id: string; lo_id: string }>();
  for (const r of leadRows ?? []) {
    if (!r.org_id || !r.assigned_to) continue;
    pairs.set(`${r.org_id}|${r.assigned_to}`, { org_id: r.org_id as string, lo_id: r.assigned_to as string });
  }

  let snapshotsWritten = 0;
  for (const { org_id, lo_id } of Array.from(pairs.values())) {
    for (const periodDays of PERIODS) {
      const { rows, period_end } = await computeReferralROI(sb, org_id, lo_id, periodDays);
      for (const row of rows) {
        if (row.source_type === 'untagged') continue; // display-only; don't snapshot
        const { error } = await sb.from('roi_snapshots').insert({
          org_id, lo_id,
          source_type: row.source_type,
          source_detail: row.source_detail,
          period_days: periodDays,
          period_end,
          leads_count: row.leads_count,
          closed_count: row.closed_count,
          total_gross_comp: row.total_gross_comp,
          total_cost: row.total_cost,
          close_rate: row.close_rate,
          cost_per_closed: row.cost_per_closed,
          roi_multiple: row.roi_multiple,
        });
        if (!error) snapshotsWritten += 1; // unique-violation re-runs are ignored
      }
    }
  }

  return NextResponse.json({ processed_users: pairs.size, snapshots_written: snapshotsWritten });
}
