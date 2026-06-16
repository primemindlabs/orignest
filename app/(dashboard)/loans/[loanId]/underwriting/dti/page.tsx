import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { DtiWorksheet } from './DtiWorksheet';
import { DscrWorksheet } from './DscrWorksheet';
import { isTridExempt } from '@/lib/compliance/tridExempt';

export const dynamic = 'force-dynamic';

export default async function DtiPage({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('id, loan_type, loan_category').eq('id', params.loanId).eq('org_id', orgId).maybeSingle();
  if (!lead) notFound();

  // DSCR / non-QM / commercial qualify on the property's DSCR ratio, not borrower DTI.
  if (isTridExempt(lead)) {
    return (
      <div className="max-w-2xl space-y-4">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">DSCR Analysis</h1>
          <p className="text-[13px] text-[var(--c-label2)] mt-0.5">This business-purpose loan qualifies on property cash flow (rent ÷ PITIA), not borrower DTI.</p>
        </div>
        <DscrWorksheet initial={{ monthlyRent: 0, pitia: 0 }} />
      </div>
    );
  }

  let { data: dti } = await sb.from('dti_worksheets').select('*').eq('lead_id', params.loanId).maybeSingle();
  if (!dti) {
    const { data } = await sb.from('dti_worksheets').insert({ org_id: orgId, lead_id: params.loanId }).select('*').single();
    dti = data;
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">DTI Worksheet</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">Ratios auto-calculate from the inputs; override any value to pin it.</p>
      </div>
      <DtiWorksheet
        loanId={params.loanId}
        initial={{
          total_monthly_income: Number(dti?.total_monthly_income ?? 0),
          proposed_housing_payment: Number(dti?.proposed_housing_payment ?? 0),
          other_monthly_debts: Number(dti?.other_monthly_debts ?? 0),
          front_end_dti: dti?.front_end_dti != null ? Number(dti.front_end_dti) : null,
          back_end_dti: dti?.back_end_dti != null ? Number(dti.back_end_dti) : null,
          overrides: (dti?.overrides ?? {}) as Record<string, unknown>,
        }}
      />
    </div>
  );
}
