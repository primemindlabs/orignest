import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { DecisionPanel } from './DecisionPanel';

export const dynamic = 'force-dynamic';

export default async function DecisionPage({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('id').eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) notFound();
  const { data: uw } = await sb.from('uw_files').select('decision, decision_notes').eq('lead_id', params.loanId).maybeSingle();

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Underwriting Decision</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Record the underwriting outcome and rationale.</p>
      </div>
      <DecisionPanel loanId={params.loanId} initialDecision={uw?.decision ?? null} initialNotes={uw?.decision_notes ?? null} />
    </div>
  );
}
