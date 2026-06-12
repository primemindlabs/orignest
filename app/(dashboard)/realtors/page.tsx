import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { RealtorsHub } from '@/components/realtors/RealtorsHub';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Realtors' };

export default async function RealtorsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const [{ data: realtors }, { data: assets }, { data: heat }] = await Promise.all([
    sb
      .from('realtors')
      .select(
        'id, first_name, last_name, brokerage_name, primary_city, phone, email, volume_12m, transactions_12m, deals_referred_12m, last_contact_at, partnership_tier'
      )
      .eq('org_id', orgId)
      .eq('is_archived', false)
      .order('partnership_score', { ascending: false })
      .limit(500),
    sb
      .from('realtor_cobrand_assets')
      .select('id, realtor_id, asset_type, title, file_url, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50),
    sb
      .from('realtor_heat_scores')
      .select('realtor_id, score, band, deals_90d')
      .eq('org_id', orgId)
      .limit(500),
  ]);

  // Merge the latest heat score onto each realtor (Phase 95 momentum signal).
  const heatMap = new Map((heat ?? []).map((h) => [h.realtor_id, h]));
  const realtorsWithHeat = (realtors ?? []).map((r) => {
    const h = heatMap.get(r.id);
    return { ...r, heat_score: h?.score ?? null, heat_band: h?.band ?? null, heat_deals_90d: h?.deals_90d ?? null };
  });

  return (
    <div className="max-w-3xl">
      <RealtorsHub realtors={realtorsWithHeat} assets={assets ?? []} />
    </div>
  );
}
