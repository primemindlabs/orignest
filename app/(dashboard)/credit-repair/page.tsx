import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import { CreditRepairClient } from './CreditRepairClient';
import { ConsumerCreditRepairPanel } from './ConsumerCreditRepairPanel';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Credit Repair Pipeline' };

export default async function CreditRepairPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: org } = await sb
    .from('organizations')
    .select('id, name')
    .eq('clerk_org_id', orgId)
    .maybeSingle();

  if (!org) redirect('/dashboard');

  const [{ data: pipeline }, { data: leads }, { data: partners }] = await Promise.all([
    sb
      .from('credit_repair_pipeline')
      .select(`
        id, target_program, target_score, starting_score, current_score,
        score_history, known_issues, status, credit_repair_partner,
        checkin_frequency_days, next_checkin_date, ai_action_plan,
        reactivated_at, created_at, updated_at,
        leads(id, first_name, last_name, email, phone, loan_type, loan_amount)
      `)
      .eq('org_id', org.id)
      .order('created_at', { ascending: false }),
    sb
      .from('leads')
      .select('id, first_name, last_name, email, loan_type, estimated_credit_score')
      .eq('org_id', org.id)
      .not('stage', 'in', '("closed","withdrawn")')
      .order('first_name'),
    sb
      .from('credit_repair_partners')
      .select('id, name, contact_name, email, phone, avg_timeline_days, success_rate')
      .eq('org_id', org.id)
      .eq('is_active', true)
      .order('name'),
  ]);

  // KPI calculations
  const all = pipeline ?? [];
  const enrolledCount = all.filter((r) => r.status !== 'qualified' && r.status !== 'stopped_responding').length;
  const qualifiedMTD = all.filter((r) => {
    if (r.status !== 'qualified' && r.status !== 'reactivated') return false;
    const reactivated = r.reactivated_at as string | null;
    if (!reactivated) return false;
    const d = new Date(reactivated);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const avgScoreGain = all.reduce((sum, r) => {
    const current = (r.current_score as number | null) ?? (r.starting_score as number);
    const start = r.starting_score as number;
    return sum + (current - start);
  }, 0) / Math.max(all.length, 1);

  const estPipelineValue = all
    .filter((r) => r.status !== 'stopped_responding')
    .reduce((sum, r) => {
      const lead = r.leads as { loan_amount: number | null } | null;
      return sum + ((lead?.loan_amount ?? 300000) * 0.01); // rough 1% origination fee
    }, 0);

  return (
    <>
    <ConsumerCreditRepairPanel />
    <CreditRepairClient
      orgId={org.id}
      pipeline={all}
      availableLeads={(leads ?? []) as Array<{ id: string; first_name: string; last_name: string; email: string; loan_type: string | null; estimated_credit_score: number | null }>}
      partners={(partners ?? []) as Array<{ id: string; name: string; contact_name: string | null; email: string | null; phone: string | null; avg_timeline_days: number | null; success_rate: number | null }>}
      kpis={{ enrolledCount, qualifiedMTD, avgScoreGain, estPipelineValue }}
    />
    </>
  );
}