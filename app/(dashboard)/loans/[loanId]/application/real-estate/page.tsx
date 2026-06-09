import { LoanSectionPlaceholder } from '@/components/loan/LoanSectionPlaceholder';

export const dynamic = 'force-dynamic';

export default function Page() {
  return <LoanSectionPlaceholder title="Real Estate Owned" note="Shown only when the borrower owns other real estate." />;
}
