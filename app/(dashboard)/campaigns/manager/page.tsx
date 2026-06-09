import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { CampaignManagerClient } from './CampaignManagerClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Campaign Manager' };

export default async function CampaignManagerPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Campaign Manager</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          A library of ready-to-use mortgage campaigns. Every message is AI-personalized per borrower. Rate Drop and Market Updates now live here as campaign types.
        </p>
      </div>
      <CampaignManagerClient />
    </div>
  );
}
