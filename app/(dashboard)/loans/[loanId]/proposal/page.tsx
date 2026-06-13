// Phase 122 — LO proposal generator for a loan.
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProposalGenerator } from '@/components/proposals/ProposalGenerator';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Loan Proposal' };

export default async function ProposalToolPage({ params }: { params: Promise<{ loanId: string }> }) {
  const { loanId } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('id, first_name, last_name').eq('id', loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) redirect('/pipeline');

  const [{ data: scenarios }, { data: proposals }] = await Promise.all([
    sb.from('loan_scenarios').select('id, scenario_name, loan_type, loan_amount, interest_rate, loan_term_months, monthly_payment, is_recommended').eq('org_id', orgId).eq('lead_id', loanId).order('sort_order', { ascending: true }),
    sb.from('loan_proposals').select('id, share_token, recommended_scenario_id, sent_at, sent_channel, viewed_at, borrower_choice_scenario_id, created_at').eq('org_id', orgId).eq('lead_id', loanId).order('created_at', { ascending: false }),
  ]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Loan Proposal</h1>
        <p className="text-sm text-gray-400">Generate a personalized proposal for {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'this borrower'}.</p>
      </div>
      <ProposalGenerator
        loanId={loanId}
        scenarios={(scenarios ?? []) as any[]}
        initialProposals={(proposals ?? []) as any[]}
      />
    </div>
  );
}
