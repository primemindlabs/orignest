import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

function tier(score: number | null): { label: string; tone: string; note: string } {
  if (score == null) return { label: 'No score on file', tone: 'var(--c-label2)', note: 'Pull credit to populate the score tier.' };
  if (score >= 740) return { label: 'Excellent', tone: 'var(--c-success)', note: 'Best pricing tiers available across programs.' };
  if (score >= 680) return { label: 'Good', tone: 'var(--c-success)', note: 'Qualifies for conventional and most government programs.' };
  if (score >= 620) return { label: 'Fair', tone: 'var(--c-warning)', note: 'FHA/VA eligible; conventional pricing adjustments apply.' };
  return { label: 'Below 620', tone: 'var(--c-danger)', note: 'Limited to FHA 203(k), portfolio, or non-QM. Review the credit-improvement path.' };
}

export default async function CreditPage({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');
  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('id, credit_score').eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) notFound();

  const score = lead.credit_score != null ? Number(lead.credit_score) : null;
  const t = tier(score);

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Credit Analysis</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Qualifying credit tier for this borrower.</p>
      </div>
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] p-5 flex items-center gap-5">
        <div className="text-center">
          <p className="text-[34px] font-bold tabular-nums leading-none" style={{ color: t.tone }}>{score ?? '—'}</p>
          <p className="text-[11px] text-[var(--c-label3)] mt-1 uppercase tracking-wide">Mid score</p>
        </div>
        <div className="border-l border-[var(--c-border)] pl-5">
          <p className="text-[15px] font-semibold" style={{ color: t.tone }}>{t.label}</p>
          <p className="text-[13px] text-[var(--c-label2)] mt-1 leading-relaxed max-w-sm">{t.note}</p>
        </div>
      </div>
      <p className="text-[12px] text-[var(--c-label3)]">Tradeline detail and derogatory review populate from the credit pull once the bureau response is on file.</p>
    </div>
  );
}
