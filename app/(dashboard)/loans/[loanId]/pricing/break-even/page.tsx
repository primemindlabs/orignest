import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { BreakEvenCalculator } from './BreakEvenCalculator';

export const dynamic = 'force-dynamic';

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

  // Rough proposed-payment prefill from loan amount (estimate @ 6.5% / 30yr P&I).
  const loanAmount = Number(lead?.loan_amount ?? 0) || 0;
  let suggestedPayment = 0;
  if (loanAmount > 0) {
    const r = 0.065 / 12;
    const n = 360;
    suggestedPayment = Math.round((loanAmount * r) / (1 - Math.pow(1 + r, -n)));
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Break-Even Analysis</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          Model how long it takes for monthly savings to recoup the closing costs of a buy-down or refinance.
        </p>
      </div>
      <BreakEvenCalculator suggestedPayment={suggestedPayment} loanAmount={loanAmount} />
    </div>
  );
}
