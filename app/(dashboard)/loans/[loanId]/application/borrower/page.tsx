import { LoanSectionPlaceholder } from '@/components/loan/LoanSectionPlaceholder';

export const dynamic = 'force-dynamic';

export default function Page() {
  return <LoanSectionPlaceholder title="Borrower Info" note="Borrower identity fields adapt to the loan program via the smart 1003 form." />;
}
