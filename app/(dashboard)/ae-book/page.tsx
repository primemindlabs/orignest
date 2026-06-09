import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { deriveFeatureSet } from '@/lib/platform/featureFlags';
import { AEBookClient } from './AEBookClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'AE Book of Business' };

export default async function AEBookPage() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: org } = await sb.from('organizations').select('channel').eq('id', orgId).maybeSingle();
  // Gate to channels/roles that have the AE feature (direct lender / correspondent; admin always).
  if (!deriveFeatureSet(org?.channel, role).ae_book_of_business && role !== 'admin') notFound();

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">AE Book of Business</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Your broker accounts, grouped by relationship health. At-risk and dormant brokers surface first — that&apos;s who to call today.</p>
      </div>
      <AEBookClient />
    </div>
  );
}
