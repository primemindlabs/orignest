import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { deriveLoanContext } from '@/lib/ui/fieldAdapter';
import { RiskPanel } from './RiskPanel';

export const dynamic = 'force-dynamic';

// Layered risk model — higher = riskier. Derived from real loan data.
function buildRisk(args: { backDti: number | null; credit: number | null; downPct: number }) {
  const factors: { label: string; points: number }[] = [];
  let score = 10;
  const add = (label: string, points: number) => { factors.push({ label, points }); score += points; };

  const dti = args.backDti;
  add('Debt-to-income', dti == null ? 0 : dti > 50 ? 30 : dti > 43 ? 18 : dti > 36 ? 8 : 0);

  const c = args.credit;
  add('Credit tier', c == null ? 0 : c < 620 ? 30 : c < 680 ? 18 : c < 720 ? 8 : 0);

  add('Down payment / LTV', args.downPct < 5 ? 20 : args.downPct < 10 ? 12 : args.downPct < 20 ? 5 : 0);

  return { score: Math.max(0, Math.min(100, Math.round(score))), factors };
}

export default async function RiskPage({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('id, loan_type, loan_purpose, occupancy_type, property_type, loan_amount, down_payment, estimated_value, credit_score')
    .eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) notFound();

  const [{ data: dti }, { data: uw }] = await Promise.all([
    sb.from('dti_worksheets').select('back_end_dti').eq('lead_id', params.loanId).maybeSingle(),
    sb.from('uw_files').select('risk_score').eq('lead_id', params.loanId).maybeSingle(),
  ]);

  const ctx = deriveLoanContext(lead);
  const { score, factors } = buildRisk({
    backDti: dti?.back_end_dti != null ? Number(dti.back_end_dti) : null,
    credit: lead.credit_score != null ? Number(lead.credit_score) : null,
    downPct: ctx.down_payment_pct,
  });

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Risk Score</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Layered risk from DTI, credit, and LTV. Override to set a manual score.</p>
      </div>
      <RiskPanel loanId={params.loanId} suggested={score} factors={factors} initialScore={uw?.risk_score != null ? Number(uw.risk_score) : null} />
    </div>
  );
}
