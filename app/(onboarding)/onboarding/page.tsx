import { redirect } from 'next/navigation';
import { getOrgContext } from '@/lib/auth/orgContext';
import { OnboardingClient } from './OnboardingClient';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  // Resolve the org from Supabase (getOrgContext), NOT Clerk memberships — Clerk
  // Organizations are off-plan, so existing users have no Clerk membership and were
  // wrongly shown "Create your workspace". If they already have an org, go straight
  // to the dashboard. Only genuinely org-less users see the create-workspace form.
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (orgId) redirect('/dashboard');

  return <OnboardingClient email={null} />;
}
