import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { McrClient } from './McrClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Mortgage Call Report' };

const ADMIN = ['admin', 'branch_manager'];

export default async function McrPage() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  if (!ADMIN.includes(role)) redirect('/reports');

  return (
    <div className="max-w-4xl">
      <Link href="/reports" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3"><ArrowLeft size={14} /> Reports</Link>
      <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Mortgage Call Report (MCR)</h1>
      <p className="text-[13px] text-[var(--c-label2)] mt-0.5 mb-5">A quarterly NMLS RMLA worksheet — application and closed-loan activity by state and loan type. Use it to complete your MCR filing in NMLS; export the figures as CSV.</p>
      <McrClient />
    </div>
  );
}
