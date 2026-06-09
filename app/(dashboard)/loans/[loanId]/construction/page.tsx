import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ConstructionClient } from './ConstructionClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Construction Loan' };

export default async function ConstructionPage({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('id, first_name, last_name').eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) notFound();

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href={`/leads/${params.loanId}`} className="inline-flex items-center gap-1.5 text-[13px] text-[var(--c-label2)] hover:text-[var(--c-text)] mb-3"><ArrowLeft size={14} /> {lead.first_name} {lead.last_name}</Link>
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Construction Loan</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">One-time and two-time-close construction loans — draw schedule, inspections, and documents. The final draw is gated on an approved Certificate of Occupancy.</p>
      </div>
      <ConstructionClient loanId={params.loanId} />
    </div>
  );
}
