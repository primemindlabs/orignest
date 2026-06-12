import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ConversionFunnelClient } from './ConversionFunnelClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Conversion Funnel' };

export default async function ConversionFunnelPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  return <ConversionFunnelClient />;
}
