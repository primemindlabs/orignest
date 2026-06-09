import { LoanSectionPlaceholder } from '@/components/loan/LoanSectionPlaceholder';

export const dynamic = 'force-dynamic';

export default function Page() {
  return <LoanSectionPlaceholder title="Rate Lock" note="Lock status, expiration, and extensions." />;
}
