// Phase 108 — Branch Manager Dashboard. Enhanced in place (was a leaderboard+funnel).
// Read-only, role-guarded (branch_manager/admin via requireTenantAdmin), computed LIVE
// from profiles/leads/trid_events — no snapshot tables, no cron.
// Phase 130 — Business Pulse™ hero mounted on top (Team tier only).
import { requireTenantAdmin } from '@/lib/admin/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Metadata } from 'next';
import { computeBranchData } from '@/lib/branch/compute';
import { BranchDashboardClient } from '@/components/branch/BranchDashboardClient';
import { resolveOrgTier } from '@/lib/billing/featureGate';
import { hasFeature } from '@/lib/billing/features';
import { resolveLoProfile } from '@/lib/autopilot/loContext';
import { ensureTodaysPulse } from '@/lib/businessPulse/computePulseScore';
import { PulseScoreHero } from '@/components/businessPulse/PulseScoreHero';
import type { PulseRow } from '@/lib/businessPulse/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Branch Dashboard' };

export default async function BranchDashboardPage() {
  const { userId, orgId } = await requireTenantAdmin();
  const sb = createAdminClient();

  // Business Pulse hero — Team tier only, best-effort (never blocks the dashboard).
  let pulse: PulseRow | null = null;
  try {
    const tier = await resolveOrgTier(orgId);
    if (hasFeature(tier, 'business_pulse')) {
      const profile = await resolveLoProfile(sb, userId);
      if (profile?.id) pulse = await ensureTodaysPulse(sb, orgId, profile.id);
    }
  } catch (e) {
    console.error('[branch] pulse hero failed', e);
  }

  const data = await computeBranchData(sb, orgId);

  return (
    <div className="flex flex-col gap-4">
      {pulse && (
        <div className="px-1 pt-1">
          <PulseScoreHero score={pulse} linkToDetail />
        </div>
      )}
      <BranchDashboardClient data={data} />
    </div>
  );
}
