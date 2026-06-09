import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { FloodZonePanel } from './FloodZonePanel';

export const dynamic = 'force-dynamic';

export default async function FloodZonePage({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('id, property_address, flood_zone, flood_panel, flood_zone_source, flood_zone_required, flood_zone_determined_at')
    .eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) notFound();

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Flood Zone</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">FEMA flood hazard determination for the subject property.</p>
      </div>
      <FloodZonePanel
        loanId={params.loanId}
        hasAddress={!!lead.property_address}
        initial={{
          zone: lead.flood_zone, panel: lead.flood_panel, source: lead.flood_zone_source,
          required: lead.flood_zone_required, determined_at: lead.flood_zone_determined_at,
        }}
      />
    </div>
  );
}
