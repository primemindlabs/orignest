// "Ashley's Impact" — the ROI / renewal story. What Ashley did for your team this month.
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ImpactClient } from './ImpactClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: "Ashley's Impact" };

export default async function ImpactPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Ashley&rsquo;s Impact</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">What Ashley did for your team this month — automations sent, deals moved, and time saved.</p>
      </div>
      <ImpactClient />
    </div>
  );
}
