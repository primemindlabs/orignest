import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { OutreachClient } from '@/components/outreach/OutreachClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Outreach' };

export default async function OutreachPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Outreach"
        subtitle="Birthday & anniversary touch-points, reviewed before they send."
      />
      <div className="mt-4">
        <OutreachClient />
      </div>
    </div>
  );
}
