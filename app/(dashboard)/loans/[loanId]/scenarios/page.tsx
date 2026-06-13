import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ScenarioBuilder } from '@/components/loan/ScenarioBuilder';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Scenario Builder' };

export default async function ScenarioBuilderPage({ params }: { params: Promise<{ loanId: string }> }) {
  const { loanId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-6xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Loan Scenario Builder</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Compare up to 4 scenarios side by side, mark a recommendation, and print a clean comparison for the borrower.
        </p>
      </div>
      <ScenarioBuilder loanId={loanId} />
    </div>
  );
}
