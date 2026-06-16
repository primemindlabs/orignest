import { notFound } from 'next/navigation';
import { getLoanSummary } from '@/lib/loans/getLoanSummary';
import { isTridExempt } from '@/lib/compliance/tridExempt';
import { CdBalancerClient } from './CdBalancerClient';

export const dynamic = 'force-dynamic';

// Loan-type-aware CD Balancer. Business-purpose files (DSCR / non-QM / commercial)
// are TRID-exempt, so the lender-cure regime doesn't apply — they get a settlement
// reconciliation instead. Consumer files get the tolerance balancer, with
// program-specific government fees (VA / FHA / USDA) injected.
export default async function CdBalancerPage({ params }: { params: { loanId: string } }) {
  const loan = await getLoanSummary(params.loanId);
  if (!loan) notFound();

  const exempt = isTridExempt({ loan_category: loan.context.loan_category });

  return (
    <CdBalancerClient
      borrowerName={loan.borrowerName}
      programLabel={loan.programLabel}
      loanProgram={loan.context.loan_program}
      exempt={exempt}
    />
  );
}
