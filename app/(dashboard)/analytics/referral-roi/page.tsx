import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ReferralROIClient } from './ReferralROIClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Referral Source ROI' };

export default async function ReferralRoiPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  return <ReferralROIClient />;
}
