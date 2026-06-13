import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { SpeedToLeadClient } from './SpeedToLeadClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Respond Now' };

export default async function SpeedToLeadPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  return (
    <div className="max-w-2xl">
      <div className="mb-5">
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Respond Now</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">New leads you haven&rsquo;t reached yet, oldest first. Speed wins loans — the first lender to respond closes far more often.</p>
      </div>
      <SpeedToLeadClient />
    </div>
  );
}
