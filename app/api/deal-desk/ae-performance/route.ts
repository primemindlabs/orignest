// Phase 120 — per-AE deal-desk performance (response rate, avg turnaround, win rate).
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ performance: [] });

  const sb = createAdminClient();
  const { data } = await sb
    .from('ae_deal_desk_requests')
    .select('lender_ae_id, lender_name, ae_name, status, submitted_at, ae_responded_at')
    .eq('org_id', orgId);

  const rows = data ?? [];
  const byAe = new Map<string, { lender_name: string | null; ae_name: string | null; submitted: number; responded: number; approved: number; turnaroundHrsSum: number; turnaroundN: number }>();

  for (const r of rows) {
    const key = (r.lender_ae_id as string) ?? `${r.lender_name ?? '?'}|${r.ae_name ?? '?'}`;
    const e = byAe.get(key) ?? { lender_name: (r.lender_name as string) ?? null, ae_name: (r.ae_name as string) ?? null, submitted: 0, responded: 0, approved: 0, turnaroundHrsSum: 0, turnaroundN: 0 };
    const status = r.status as string;
    if (status !== 'draft') e.submitted += 1;
    if (['responded', 'approved', 'declined'].includes(status) && r.ae_responded_at) e.responded += 1;
    if (status === 'approved') e.approved += 1;
    if (r.submitted_at && r.ae_responded_at) {
      const hrs = (new Date(r.ae_responded_at as string).getTime() - new Date(r.submitted_at as string).getTime()) / 3_600_000;
      if (hrs >= 0) { e.turnaroundHrsSum += hrs; e.turnaroundN += 1; }
    }
    byAe.set(key, e);
  }

  const performance = Array.from(byAe.values())
    .map((e) => ({
      lender_name: e.lender_name,
      ae_name: e.ae_name,
      submitted: e.submitted,
      responded: e.responded,
      approved: e.approved,
      response_rate: e.submitted ? Math.round((e.responded / e.submitted) * 100) : 0,
      win_rate: e.responded ? Math.round((e.approved / e.responded) * 100) : 0,
      avg_turnaround_hours: e.turnaroundN ? Math.round((e.turnaroundHrsSum / e.turnaroundN) * 10) / 10 : null,
    }))
    .sort((a, b) => b.submitted - a.submitted);

  return NextResponse.json({ performance });
}
