import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { ConditionsManager, type Condition } from '@/components/loan/ConditionsManager';

export const dynamic = 'force-dynamic';

export async function loadConditions(loanId: string, orgId: string): Promise<Condition[]> {
  const sb = createAdminClient();
  const { data } = await sb
    .from('loan_conditions')
    .select('id, condition_text, category, priority, status, due_date')
    .eq('lead_id', loanId).eq('org_id', orgId)
    .order('created_at', { ascending: true });
  return (data ?? []) as Condition[];
}

export default async function ConditionsPage({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('id').eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) notFound();

  const conditions = await loadConditions(params.loanId, orgId);

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Conditions</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Track and clear loan conditions for this file.</p>
      </div>
      <ConditionsManager loanId={params.loanId} initial={conditions} />
    </div>
  );
}
