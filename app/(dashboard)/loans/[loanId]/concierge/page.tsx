import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ConciergePanel } from '@/components/concierge/ConciergePanel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Ashley Concierge' };

export default async function LeadConciergePage({ params }: { params: Promise<{ loanId: string }> }) {
  const { loanId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-2xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-[var(--c-text)]">Ashley Concierge</h1>
        <p className="text-sm text-[var(--c-label2)] mt-0.5">
          The AI text conversation with this borrower. Choose how hands-off Ashley is, approve drafted replies, and test how she'd respond. Configure your persona in <Link href="/settings/concierge" className="underline">Settings → Ashley Concierge</Link>.
        </p>
      </div>
      <ConciergePanel leadId={loanId} />
    </div>
  );
}
