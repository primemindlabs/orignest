import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { AutomationsClient } from '@/components/automations/AutomationsClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Milestone Automations' };

export default async function AutomationsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  return <AutomationsClient />;
}
