// Phase 108 — per-LO drill-down (read-only). Role-guarded; live-computed.
import { requireTenantAdmin } from '@/lib/admin/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { computeBranchData } from '@/lib/branch/compute';
import { LOProfileCard } from '@/components/branch/LOProfileCard';
import { BackLink } from '@/components/branch/BackLink';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Loan Officer' };

export default async function LODetailPage({ params }: { params: Promise<{ loId: string }> }) {
  const { loId } = await params;
  const { orgId } = await requireTenantAdmin();
  const sb = createAdminClient();
  const { team } = await computeBranchData(sb, orgId);
  const lo = team.find((m) => m.lo_id === loId);
  if (!lo) redirect('/branch');

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-5">
        <BackLink />
        <h1 className="text-xl font-semibold text-gray-900">{lo.name}</h1>
      </div>
      <LOProfileCard lo={lo} />
    </div>
  );
}
