// Phase 108 — Branch Manager Dashboard. Enhanced in place (was a leaderboard+funnel).
// Read-only, role-guarded (branch_manager/admin via requireTenantAdmin), computed LIVE
// from profiles/leads/trid_events — no snapshot tables, no cron.
import { requireTenantAdmin } from '@/lib/admin/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Metadata } from 'next';
import { computeBranchData } from '@/lib/branch/compute';
import { BranchDashboardClient } from '@/components/branch/BranchDashboardClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Branch Dashboard' };

export default async function BranchDashboardPage() {
  const { orgId } = await requireTenantAdmin();
  const sb = createAdminClient();
  const data = await computeBranchData(sb, orgId);
  return <BranchDashboardClient data={data} />;
}
