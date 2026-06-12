import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getOrgContext } from '@/lib/auth/orgContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { TeamChatClient } from './TeamChatClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Team Chat' };

export default async function TeamChatPage() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-6xl">
      <PageHeader title="Team Chat" subtitle="Internal messaging for your team — compliance-archived." />
      <Suspense fallback={<p className="text-[13px] text-[var(--c-label2)]">Loading…</p>}>
        <TeamChatClient role={role} />
      </Suspense>
    </div>
  );
}
