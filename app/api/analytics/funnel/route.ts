/**
 * Phase 99 — GET /api/analytics/funnel?period=30|60|90|180
 * Live per-LO funnel from the stage_transitions log (not snapshots). Clerk-scoped.
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { computeFunnel } from '@/lib/funnel/compute';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PERIODS = [30, 60, 90, 180];

export async function GET(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const p = parseInt(new URL(req.url).searchParams.get('period') ?? '90', 10);
  const periodDays = PERIODS.includes(p) ? p : 90;

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const result = await computeFunnel(sb, orgId, profile.id, periodDays);
  return NextResponse.json(result);
}
