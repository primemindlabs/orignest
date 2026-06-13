// Phase 109 — internal team chat for a loan file. Access is enforced in the API
// (assigned LO / processors / LOAs / managers); this page just requires auth.
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { InFileChat } from '@/components/loan/InFileChat';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Internal Team Chat' };

export default async function InternalChatPage({ params }: { params: Promise<{ loanId: string }> }) {
  const { loanId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Internal Team Chat</h1>
      <InFileChat loanId={loanId} />
    </div>
  );
}
