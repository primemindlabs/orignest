import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { LenderSubmission } from '@/components/loan/LenderSubmission';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Submit to Lender' };

export default async function SubmitToLenderPage({ params }: { params: Promise<{ loanId: string }> }) {
  const { loanId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-[var(--c-text)]">Submit to Wholesale Lender</h1>
        <p className="text-sm text-[var(--c-label2)] mt-0.5">
          Send this loan's MISMO 3.4 (URLA) file to a connected wholesale lender and request a rate lock. Lender-agnostic — works with any system that ingests MISMO 3.4.
        </p>
      </div>
      <LenderSubmission loanId={loanId} />
    </div>
  );
}
