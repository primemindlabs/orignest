import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { DisclosureGenerator } from '@/components/loan/DisclosureGenerator';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Generate Loan Estimate' };

export default async function GenerateDisclosurePage({ params }: { params: Promise<{ loanId: string }> }) {
  const { loanId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  return (
    <div className="max-w-2xl">
      <Link href={`/loans/${loanId}/disclosures`} className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3"><ArrowLeft size={14} /> Disclosures</Link>
      <h1 className="text-xl font-semibold text-[var(--c-text)]">Generate Loan Estimate</h1>
      <p className="text-sm text-[var(--c-label2)] mt-0.5 mb-5">Build a preliminary Loan Estimate from the application terms + a fee worksheet, then issue it to the borrower. Issuing logs the TRID clock and creates a borrower acknowledgment link.</p>
      <DisclosureGenerator loanId={loanId} />
    </div>
  );
}
