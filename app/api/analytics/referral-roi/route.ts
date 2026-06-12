/**
 * Phase 98 — GET /api/analytics/referral-roi?period=30|60|90|180
 * Live per-LO ROI aggregation (does NOT read roi_snapshots — those are the cron's
 * audit trail). Clerk-scoped to the caller's own book (leads.assigned_to).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeReferralROI } from '@/lib/analytics/aggregate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PERIODS = [30, 60, 90, 180];

export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const p = Number(new URL(req.url).searchParams.get('period') ?? '90');
  const periodDays = PERIODS.includes(p) ? p : 90;

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { rows, period_start, period_end } = await computeReferralROI(sb, orgId, profile.id, periodDays);
  return NextResponse.json({ data: rows, period_days: periodDays, period_start, period_end });
}
