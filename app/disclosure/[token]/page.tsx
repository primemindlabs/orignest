import type { Metadata } from 'next';
import { DisclosureView } from './DisclosureView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Your Loan Estimate', robots: { index: false, follow: false } };

// Public, token-gated borrower view of an issued Loan Estimate.
export default async function DisclosurePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <DisclosureView token={token} />;
}
