import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CompSettings, type CompPlan } from '@/components/settings/CompSettings';
import { CompPipelineSummary } from '@/components/comp/CompPipelineSummary';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Compensation' };

export default async function CompensationSettingsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: profile } = await sb
    .from('profiles')
    .select('comp_rate')
    .eq('clerk_user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle();

  const { data: plans } = await sb
    .from('comp_plans')
    .select('id, name, comp_bps, comp_flat, basis, is_active, min_loan_amount, max_loan_amount')
    .eq('org_id', orgId)
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-[13px] text-label-2 hover:text-black transition-colors"
        >
          <ArrowLeft size={14} />
          Settings
        </Link>
        <h1 className="text-[22px] font-bold text-black tracking-tight mt-2">Compensation</h1>
        <p className="text-label-2 text-sm mt-0.5">
          Your commission rate for dashboard math, plus your company&apos;s comp plans.
        </p>
      </div>

      <CompPipelineSummary />

      <CompSettings compRate={profile?.comp_rate ?? null} plans={(plans ?? []) as CompPlan[]} />
    </div>
  );
}
