import { LoanSectionPlaceholder } from '@/components/loan/LoanSectionPlaceholder';

export const dynamic = 'force-dynamic';

export default function Page() {
  return <LoanSectionPlaceholder title="Co-Borrower" note="Shown only when the loan has a co-borrower." />;
}
