import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ExpiringLocksWidget } from '@/components/rate-lock/ExpiringLocksWidget';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Rate Locks' };

export default async function RateLocksPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  return (
    <div className="max-w-2xl">
      <ExpiringLocksWidget />
    </div>
  );
}
