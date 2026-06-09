import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { isTextractConfigured } from '@/lib/ai/textract';
import { CompetitorAnalysisPanel } from './CompetitorAnalysisPanel';

export const dynamic = 'force-dynamic';

export default async function CompetitorAnalysisPage({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('id, loan_amount').eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) notFound();

  const { data: latest } = await sb
    .from('competitor_le_uploads')
    .select('competitor_name, competitor_rate, competitor_total_closing_costs, our_le_snapshot, analysis')
    .eq('lead_id', params.loanId)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Competitor LE Analysis</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Borrower shopping rates? Turn a competitor&apos;s Loan Estimate into phone talking points in 60 seconds.
        </p>
      </div>
      <CompetitorAnalysisPanel
        loanId={params.loanId}
        loanAmount={lead.loan_amount}
        initial={latest ?? null}
        textractConfigured={isTextractConfigured()}
      />
    </div>
  );
}
