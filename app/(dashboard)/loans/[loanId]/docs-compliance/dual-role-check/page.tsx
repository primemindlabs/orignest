import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect, notFound } from 'next/navigation';
import { DualRoleChecklist } from './DualRoleChecklist';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: lead } = await sb
    .from('leads')
    .select('id, referral_realtor_id')
    .eq('id', params.loanId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) notFound();

  // Defensively surface the referring agent (if linked) as review context.
  let realtorContext: { name: string; brokerage: string | null } | null = null;
  if (lead.referral_realtor_id) {
    try {
      const { data: realtor } = await sb
        .from('realtors')
        .select('first_name, last_name, brokerage_name')
        .eq('id', lead.referral_realtor_id)
        .eq('org_id', orgId)
        .maybeSingle();
      if (realtor) {
        const name = `${realtor.first_name ?? ''} ${realtor.last_name ?? ''}`.trim();
        realtorContext = {
          name: name || 'Referring agent',
          brokerage: realtor.brokerage_name ?? null,
        };
      }
    } catch {
      realtorContext = null;
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--c-text)] tracking-tight">Dual Role Check</h1>
        <p className="text-[13px] text-[var(--c-label2)] mt-0.5">
          RESPA dual-role &amp; affiliated-business review for this loan.
        </p>
      </div>

      <div className="rounded-[14px] border border-[var(--c-border)] bg-[var(--c-fill)] p-4">
        <p className="text-[12px] text-[var(--c-label2)] leading-relaxed">
          The Real Estate Settlement Procedures Act (RESPA) prohibits paying or accepting anything of value for the
          referral of settlement-service business and restricts wearing two hats on a single transaction. Use the
          checklist below to confirm no prohibited dual role exists and that any affiliated business arrangement on this
          file has been properly disclosed.
        </p>
      </div>

      <DualRoleChecklist loanId={params.loanId} realtorContext={realtorContext} />
    </div>
  );
}
