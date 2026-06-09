import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { MarketUpdatePanel } from './MarketUpdatePanel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Market Updates' };

export default async function MarketUpdatesPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const { data: latest } = await createAdminClient()
    .from('market_updates')
    .select('rate_30yr_fixed, rate_15yr_fixed, rate_change_bps, linkedin_post, instagram_caption, sms_blast')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Market Updates</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Enter this week&apos;s rates and Ashley IQ writes ready-to-post content for LinkedIn, Instagram, and an SMS blast.
        </p>
      </div>
      <MarketUpdatePanel initial={latest ?? null} />
    </div>
  );
}
