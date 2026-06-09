import { LoanSectionPlaceholder } from '@/components/loan/LoanSectionPlaceholder';

export const dynamic = 'force-dynamic';

export default function Page() {
  return <LoanSectionPlaceholder title="Rate Options" note="Available rate/point combinations from the pricing engine." />;
}
