import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getOrgContext } from '@/lib/auth/orgContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { AeConnectTabs } from '@/components/aeConnect/AeConnectTabs';
import { LenderAEDirectory } from '@/components/aeConnect/LenderAEDirectory';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'AE Connect' };

export default async function AeConnectPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-6xl">
      <PageHeader title="AE Connect" subtitle="Your lender Account Executive directory and branch Q&A forum." />
      <AeConnectTabs />
      <LenderAEDirectory />
    </div>
  );
}
