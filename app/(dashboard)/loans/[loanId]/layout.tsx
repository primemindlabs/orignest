import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect, notFound } from 'next/navigation';
import { getLoanSummary } from '@/lib/loans/getLoanSummary';
import { LoanHeader } from '@/components/loan/LoanHeader';
import { LoanSidebar } from '@/components/loan/LoanSidebar';
import { LoanBreadcrumb } from '@/components/loan/LoanBreadcrumb';

export const dynamic = 'force-dynamic';

// Phase 28.1 — File-within-a-file shell. The entire chrome reconfigures around
// the loan: sticky header + contextual sidebar + breadcrumb, content in <main>.
export default async function LoanLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { loanId: string };
}) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const loan = await getLoanSummary(params.loanId);
  if (!loan) notFound();

  return (
    // Fixed overlay: File mode replaces the global dashboard chrome full-screen.
    <div className="fixed inset-0 z-40 flex flex-col h-screen overflow-hidden bg-[var(--c-bg)]">
      <LoanHeader loan={loan} />
      <LoanBreadcrumb loanId={loan.id} loanName={loan.borrowerName} />
      <div className="flex flex-1 overflow-hidden">
        <LoanSidebar loanId={loan.id} loanContext={loan.context} />
        <main className="flex-1 overflow-y-auto bg-[var(--c-bg)] p-6">{children}</main>
      </div>
    </div>
  );
}
