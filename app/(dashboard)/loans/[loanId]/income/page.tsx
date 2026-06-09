import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { IncomeHubClient } from './IncomeHubClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Income Calculator' };

export default async function IncomePage({ params }: { params: { loanId: string } }) {
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
        <h1 className="text-[22px] font-bold text-[var(--c-text)] tracking-tight">Income Calculator</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Fannie/Freddie qualifying-income worksheets — W-2, self-employed (1084/91), Schedule E rental, Social Security gross-up, and 24-month variable. Each calculation is saved as an immutable audit record.</p>
      </div>
      <IncomeHubClient leadId={params.loanId} />
    </div>
  );
}
