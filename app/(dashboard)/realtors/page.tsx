import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { RealtorHubClient } from './RealtorHubClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Realtor Intelligence' };

export default async function RealtorsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Realtor Intelligence</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Your referral network, scored by partnership value. Add your top agents — each is scored on production, buyer focus, and referrals to you.
        </p>
      </div>
      <RealtorHubClient />
    </div>
  );
}
