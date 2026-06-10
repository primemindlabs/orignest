import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { DNCManagerClient } from './DNCManagerClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Do Not Call List' };

export default async function DNCPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Do Not Call List</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Your internal suppression list. The dialer and SMS sends scrub against these numbers before connecting. STOP replies are added here automatically.</p>
      </div>
      <DNCManagerClient />
    </div>
  );
}
