import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { CreditPullPanel } from '@/components/loan/CreditPullPanel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Credit' };

export default async function CreditPage({ params }: { params: Promise<{ loanId: string }> }) {
  const { loanId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-[var(--c-text)]">Credit</h1>
        <p className="text-sm text-[var(--c-label2)] mt-0.5">Pull a tri-merge credit report from a connected vendor. Lender-agnostic — any vendor with a pull endpoint works.</p>
      </div>
      <CreditPullPanel loanId={loanId} />
    </div>
  );
}
