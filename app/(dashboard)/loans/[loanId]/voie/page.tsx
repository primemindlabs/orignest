import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { VoiePanel } from '@/components/loan/VoiePanel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Income & Employment' };

export default async function VoiePage({ params }: { params: Promise<{ loanId: string }> }) {
  const { loanId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-[var(--c-text)]">Income &amp; Employment Verification</h1>
        <p className="text-sm text-[var(--c-label2)] mt-0.5">Run a VOI/VOE from a connected vendor (Truework, The Work Number, Plaid Income, or any JSON endpoint). Vendor-agnostic — verified income/employment supports the ATR/QM file.</p>
      </div>
      <VoiePanel loanId={loanId} />
    </div>
  );
}
