import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { LoanChat } from './LoanChat';

export const dynamic = 'force-dynamic';

export default async function LoanChatPage({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const { data: lead } = await createAdminClient().from('leads').select('id, first_name, last_name').eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) notFound();

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Loan Chat</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          One thread for {lead.first_name} {lead.last_name} — you control who sees each message. Financial details are never shared with realtors.
        </p>
      </div>
      <LoanChat loanId={params.loanId} />
    </div>
  );
}
