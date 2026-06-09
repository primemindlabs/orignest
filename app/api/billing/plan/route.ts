/**
 * Phase 35 — resolved plan + feature flags for the current org (drives usePlan).
 */
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveTier, FEATURE_MATRIX, daysRemaining } from '@/lib/billing/features';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const { data: org } = await sb
    .from('organizations')
    .select('subscription_plan, subscription_status, trial_ends_at, subscription_ends_at, plan_seat_count')
    .eq('id', orgId)
    .maybeSingle();

  const billing = {
    subscription_plan: org?.subscription_plan ?? null,
    subscription_status: org?.subscription_status ?? null,
    trial_ends_at: org?.trial_ends_at ?? null,
    subscription_ends_at: org?.subscription_ends_at ?? null,
  };
  const tier = resolveTier(billing);

  return NextResponse.json({
    tier,
    plan: org?.subscription_plan ?? null,
    status: org?.subscription_status ?? null,
    features: FEATURE_MATRIX[tier],
    trial_ends_at: org?.trial_ends_at ?? null,
    days_remaining: daysRemaining(org?.trial_ends_at ?? null),
    seat_count: org?.plan_seat_count ?? 1,
    is_admin: role === 'admin' || role === 'branch_manager',
  });
}
