import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { MarketUpdateClient } from './MarketUpdateClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Weekly Market Update' };

export default async function MarketUpdatePage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  return (
    <div className="max-w-5xl">
      <MarketUpdateClient />
    </div>
  );
}
