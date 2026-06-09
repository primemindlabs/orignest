import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { IntegrationsClient } from './IntegrationsClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Integrations' };

export default async function IntegrationsPage() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/settings" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3"><ArrowLeft size={14} /> Settings</Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Loan Origination System</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Connect your LOS so loan status, conditions, and contacts stay in sync. Your LOS is the system of record for loan status — Ashley IQ reflects it and never overrides it.
        </p>
      </div>
      <IntegrationsClient canManage={role === 'admin' || role === 'branch_manager'} />
    </div>
  );
}
