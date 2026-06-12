/**
 * Phase 95 — POST /api/realtors/recalculate
 * Recomputes heat scores for every (non-archived) realtor in the caller's org.
 * Org-scoped via Clerk getOrgContext. The nightly all-orgs sweep lives in
 * /api/cron/realtor-heat-scores instead (CRON_SECRET-gated).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { recalcRealtorHeatScore, type RealtorForHeat } from '@/lib/realtors/heatScore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: realtors } = await sb
    .from('realtors')
    .select('id, org_id, last_contact_at')
    .eq('org_id', orgId)
    .eq('is_archived', false)
    .limit(1000);

  const results = await Promise.allSettled(
    (realtors ?? []).map((r) => recalcRealtorHeatScore(sb, r as RealtorForHeat)),
  );
  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  return NextResponse.json({ ok: true, succeeded, failed, total: realtors?.length ?? 0 });
}
