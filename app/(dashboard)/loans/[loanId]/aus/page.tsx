import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { AusPanel } from '@/components/loan/AusPanel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Automated Underwriting (DU/LPA)' };

export default async function AusPage({ params }: { params: Promise<{ loanId: string }> }) {
  const { loanId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-[var(--c-text)]">Automated Underwriting (DU / LPA)</h1>
        <p className="text-sm text-[var(--c-label2)] mt-0.5">Submit the loan&apos;s MISMO 3.4 (URLA) file to Fannie Mae Desktop Underwriter or Freddie Mac Loan Product Advisor, and review the recommendation, eligibility, and findings. Provider-agnostic — any AUS gateway that accepts a MISMO 3.4 upload works.</p>
      </div>
      <AusPanel loanId={loanId} />
    </div>
  );
}
