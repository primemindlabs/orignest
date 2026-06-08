import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Metadata } from 'next';
import CommissionsClient, { type Commission, type Lead, type Profile } from './CommissionsClient';
import CommissionEnginePanel, { type CompPlanRow } from './CommissionEnginePanel';
import { projectPipeline, type CompPlan, type PipelineLead, type ProjectionResult } from '@/lib/commissions/engine';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Commissions' };

const OPEN_STAGES = [
  'new_inquiry', 'pre_qual', 'application', 'processing',
  'underwriting', 'conditional_approval', 'clear_to_close',
];

const displayName = (first?: string | null, last?: string | null) =>
  `${first ?? ''} ${last ?? ''}`.trim();

export default async function CommissionsPage() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  // Admin client + explicit org filter: the app authenticates with Clerk, not
  // Supabase, so an RLS read (anon key, no Clerk JWT) returns zero rows.
  const sb = createAdminClient();

  const [
    { data: commissions },
    { data: allLeads },
    { data: profiles },
    { data: plans },
    { data: openLeads },
  ] = await Promise.all([
    sb
      .from('commissions')
      .select('*, leads(first_name, last_name), profiles(first_name, last_name)')
      .eq('org_id', orgId)
      .order('close_date', { ascending: false }),
    sb
      .from('leads')
      .select('id, first_name, last_name, loan_amount, loan_type, stage')
      .eq('org_id', orgId)
      .order('first_name'),
    sb
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .order('first_name'),
    sb
      .from('comp_plans')
      .select('*, profiles(first_name, last_name)')
      .eq('org_id', orgId)
      .order('is_active', { ascending: false })
      .order('effective_date', { ascending: false }),
    sb
      .from('leads')
      .select('id, loan_amount, stage, assigned_to')
      .eq('org_id', orgId)
      .in('stage', OPEN_STAGES),
  ]);

  const flatCommissions: Commission[] = (commissions ?? []).map((c) => ({
    id: c.id as string,
    lead_id: c.lead_id as string,
    lo_id: c.lo_id as string,
    loan_amount: c.loan_amount as number,
    close_date: c.close_date as string,
    loan_type: c.loan_type as string,
    compensation_type: c.compensation_type as 'lender_paid' | 'borrower_paid',
    compensation_bps: c.compensation_bps as number | null,
    compensation_amount: c.compensation_amount as number,
    referral_fee_amount: c.referral_fee_amount as number,
    net_revenue: c.net_revenue as number | null,
    status: c.status as 'pending' | 'paid' | 'clawed_back',
    payment_date: c.payment_date as string | null,
    notes: c.notes as string | null,
    created_at: c.created_at as string,
    lead_name: displayName(
      (c.leads as { first_name?: string } | null)?.first_name,
      (c.leads as { last_name?: string } | null)?.last_name,
    ),
    lo_name: displayName(
      (c.profiles as { first_name?: string } | null)?.first_name,
      (c.profiles as { last_name?: string } | null)?.last_name,
    ),
  }));

  const leadsForModal: Lead[] = (allLeads ?? []).map((l) => ({
    id: l.id as string,
    full_name: displayName(l.first_name as string, l.last_name as string) || '(unnamed lead)',
    loan_amount: l.loan_amount as number | null,
    loan_type: l.loan_type as string | null,
    stage: l.stage as string,
  }));

  const profilesForModal: Profile[] = (profiles ?? []).map((p) => ({
    id: p.id as string,
    full_name: displayName(p.first_name as string, p.last_name as string) || '(unnamed)',
  }));

  // Probability-weighted pipeline projection, computed server-side.
  const pipelineLeads: PipelineLead[] = (openLeads ?? []).map((l) => ({
    id: l.id as string,
    loan_amount: l.loan_amount as number | null,
    stage: l.stage as string,
    lo_id: (l.assigned_to as string | null) ?? null,
  }));
  const projection: ProjectionResult = projectPipeline(pipelineLeads, (plans ?? []) as CompPlan[]);

  const planRows: CompPlanRow[] = (plans ?? []).map((p) => {
    const joined = p.profiles as { first_name?: string; last_name?: string } | null;
    return {
      id: p.id as string,
      name: p.name as string,
      basis: p.basis as 'bps' | 'flat',
      comp_bps: p.comp_bps as number | null,
      comp_flat: p.comp_flat as number | null,
      min_loan_amount: p.min_loan_amount as number,
      max_loan_amount: p.max_loan_amount as number | null,
      max_comp_amount: p.max_comp_amount as number | null,
      effective_date: p.effective_date as string,
      is_active: p.is_active as boolean,
      lo_name: joined ? displayName(joined.first_name, joined.last_name) || null : null,
    };
  });

  const isAdmin = role === 'admin' || role === 'branch_manager';

  return (
    <div className="space-y-6">
      <CommissionEnginePanel
        projection={projection}
        plans={planRows}
        profiles={profilesForModal}
        isAdmin={isAdmin}
      />
      <CommissionsClient
        commissions={flatCommissions}
        leads={leadsForModal}
        profiles={profilesForModal}
      />
    </div>
  );
}
