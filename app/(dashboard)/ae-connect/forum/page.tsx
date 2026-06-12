import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getOrgContext } from '@/lib/auth/orgContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { AeConnectTabs } from '@/components/aeConnect/AeConnectTabs';
import { AeForumClient } from '@/components/aeConnect/AeForumClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'AE Forum' };

export default async function AeForumPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-6xl">
      <PageHeader title="AE Connect" subtitle="Crowdsource lender answers from the whole branch — a living knowledge base." />
      <AeConnectTabs />
      <Suspense fallback={<p className="text-[13px] text-[var(--c-label2)]">Loading…</p>}>
        <AeForumClient />
      </Suspense>
    </div>
  );
}
