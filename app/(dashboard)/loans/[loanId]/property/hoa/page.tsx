import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { HOAClient } from '../../hoa/HOAClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'HOA Certification' };

export default async function Page({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('*')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) notFound();

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">HOA Certification</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Condo/PUD warrantability and HOA dues. Complete the project questionnaire below to run a live
          Fannie/Freddie warrantability assessment for this file — the report flags disqualifying factors
          and conditional items before submission.{' '}
          <Link href={`/loans/${params.loanId}/hoa`} className="text-[var(--c-gold-deep)] hover:underline">
            Open full HOA tool
          </Link>
          .
        </p>
      </div>
      <HOAClient loanId={params.loanId} />
    </div>
  );
}
