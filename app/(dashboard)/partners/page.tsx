// Phase 121 — Referral Partner Network. Functional dashboard for non-Realtor referral
// sources (attorneys, CPAs, advisors, insurance) — public referral links, heat, and
// one-click milestone updates. Renders all referral_partners for the org.
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { computePartnerHeat } from '@/lib/referralPartners/heat';
import { ReferralPartnerDashboard } from '@/components/referral-partners/ReferralPartnerDashboard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Referral Partners' };

export default async function PartnersPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: partners } = await sb
    .from('referral_partners')
    .select('*')
    .eq('org_id', orgId)
    .order('total_volume', { ascending: false });

  // 180-day referral momentum per partner → heat.
  const ids = (partners ?? []).map((p) => p.id);
  const counts = new Map<string, { d90: number; d180: number }>();
  if (ids.length) {
    const since = new Date(Date.now() - 180 * 86_400_000).toISOString();
    const { data: refs } = await sb.from('partner_referrals').select('partner_id, created_at').eq('org_id', orgId).in('partner_id', ids).gte('created_at', since);
    const cut90 = Date.now() - 90 * 86_400_000;
    for (const r of refs ?? []) {
      const e = counts.get(r.partner_id as string) ?? { d90: 0, d180: 0 };
      e.d180 += 1;
      if (new Date(r.created_at as string).getTime() >= cut90) e.d90 += 1;
      counts.set(r.partner_id as string, e);
    }
  }

  const rows = (partners ?? []).map((p) => {
    const c = counts.get(p.id as string) ?? { d90: 0, d180: 0 };
    const heat = computePartnerHeat({ referrals_90d: c.d90, referrals_180d: c.d180, last_outreach_at: (p.last_outreach_at as string) ?? null });
    return { ...p, referrals_90d: c.d90, heat_band: heat.band, heat_score: heat.score };
  });

  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? `https://${h.get('host') ?? 'app.ashleyiq.com'}`;

  return (
    <div className="max-w-5xl">
      <div className="mb-5">
        <h1 className="text-[22px] font-bold text-black tracking-tight">Referral Partners</h1>
        <p className="text-sm text-gray-400 mt-0.5">{rows.length} partners · attorneys, CPAs, advisors & more</p>
      </div>
      <ReferralPartnerDashboard initialPartners={rows} origin={origin} />
    </div>
  );
}
