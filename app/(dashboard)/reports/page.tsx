import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ReportsClient } from '@/components/reports/ReportsClient';
import type { RLead, RRealtor, RProfile } from '@/lib/reports/compute';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Reports' };

const MANAGER_ROLES = ['branch_manager', 'admin', 'manager'];

export default async function ReportsPage() {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: profile } = await sb
    .from('profiles')
    .select('id, comp_rate, role')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  const profileId = (profile?.id as string | undefined) ?? null;
  const effectiveRole = (profile?.role as string | undefined) ?? role ?? 'loan_officer';
  const isManager = MANAGER_ROLES.includes(effectiveRole);
  const compRate = Number(profile?.comp_rate ?? 0.5);

  // Managers see the whole org; everyone else sees their own book.
  let leadsQ = sb
    .from('leads')
    .select('id, first_name, last_name, stage, loan_amount, loan_type, lead_source, created_at, closing_date, actual_close_date, stage_changed_at, assigned_to, referral_realtor_id')
    .eq('org_id', orgId)
    .limit(5000);
  if (!isManager && profileId) leadsQ = leadsQ.eq('assigned_to', profileId);

  const [{ data: leads }, { data: realtors }, { data: team }] = await Promise.all([
    leadsQ,
    sb.from('realtors').select('id, first_name, last_name, brokerage_name').eq('org_id', orgId).eq('is_archived', false).limit(1000),
    isManager
      ? sb.from('profiles').select('id, first_name, last_name, comp_rate, monthly_volume_goal').eq('org_id', orgId).limit(200)
      : Promise.resolve({ data: [] as RProfile[] }),
  ]);

  return (
    <div className="max-w-5xl">
      <ReportsClient
        role={effectiveRole}
        compRate={compRate}
        nowISO={new Date().toISOString()}
        leads={(leads ?? []) as RLead[]}
        realtors={(realtors ?? []) as RRealtor[]}
        team={(team ?? []) as RProfile[]}
      />
    </div>
  );
}
