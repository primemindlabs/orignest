import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ShieldClient } from './ShieldClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Compliance Shield' };

export default async function CompliancePage() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  if (!['admin', 'branch_manager'].includes(role)) redirect('/dashboard');
  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Compliance Shield</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Every text is consent-checked, every disclosure is timed, and every action is logged to an immutable trail. Here&rsquo;s your posture.</p>
      </div>
      <ShieldClient />
    </div>
  );
}
