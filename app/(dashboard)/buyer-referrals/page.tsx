import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Metadata } from 'next';
import BuyerReferralsClient, { type Referral, type ReferrerOption } from './BuyerReferralsClient';
import { ReferralLinkCard } from '@/components/referrals/ReferralLinkCard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Buyer Referrals' };

export default async function BuyerReferralsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const [{ data: referrals }, { data: closedLeads }] = await Promise.all([
    sb
      .from('buyer_referrals')
      .select('*, referrer:referrer_lead_id(first_name, last_name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false }),
    sb
      .from('leads')
      .select('id, first_name, last_name')
      .eq('org_id', orgId)
      .eq('stage', 'closed')
      .order('first_name'),
  ]);

  const flat: Referral[] = (referrals ?? []).map((r) => ({
    id: r.id as string,
    referral_code: r.referral_code as string,
    referred_name: r.referred_name as string | null,
    referred_email: r.referred_email as string | null,
    referred_phone: r.referred_phone as string | null,
    status: r.status as Referral['status'],
    reward_amount: Number(r.reward_amount) || 0,
    reward_status: r.reward_status as Referral['reward_status'],
    created_at: r.created_at as string,
    referrer_name: (r.referrer as { first_name?: string; last_name?: string } | null)
      ? `${(r.referrer as { first_name?: string }).first_name ?? ''} ${(r.referrer as { last_name?: string }).last_name ?? ''}`.trim()
      : null,
  }));

  const referrers: ReferrerOption[] = (closedLeads ?? []).map((l) => ({
    id: l.id as string,
    name: `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || '(unnamed)',
  }));

  return (
    <div>
      <ReferralLinkCard />
      <BuyerReferralsClient referrals={flat} referrers={referrers} />
    </div>
  );
}
