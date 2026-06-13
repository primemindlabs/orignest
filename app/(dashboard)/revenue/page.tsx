import { auth } from '@clerk/nextjs/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Metadata } from 'next';
import RevenueClient from './RevenueClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Revenue Intelligence' };

export default async function RevenuePage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const supabase = createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', orgId)
    .maybeSingle();

  if (!org) redirect('/onboarding');

  // Fetch closed loans for revenue calculations
  // leads table uses closing_date (DATE) + updated_at; no dedicated closed_at column
  const { data: closedLeads } = await supabase
    .from('leads')
    .select('loan_amount, closing_date, updated_at, loan_type, source, assigned_to, profiles(full_name)')
    .eq('org_id', org.id)
    .eq('stage', 'closed')
    .not('loan_amount', 'is', null)
    .order('updated_at', { ascending: false });

  // Count active (non-closed, non-dead) leads for pipeline value
  const { count: activeLeadsCount } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', org.id)
    .not('stage', 'in', '(closed,dead)');

  // Compute avg loan size and historical close rate from closed data
  const closedLoans = (closedLeads ?? []).map((l) => ({
    loan_amount: (l.loan_amount as number) ?? 0,
    // Use closing_date if set, fall back to updated_at
    close_date: (l.closing_date as string) ?? (l.updated_at as string) ?? new Date().toISOString(),
    loan_type: (l.loan_type as string) ?? 'Conventional',
    source: (l.source as string) ?? 'unknown',
    assigned_to: (l.assigned_to as string) ?? '',
    lo_name: ((l.profiles as { full_name?: string } | null)?.full_name) ?? 'Unknown',
  }));

  const avgLoanSize =
    closedLoans.length > 0
      ? closedLoans.reduce((s, l) => s + l.loan_amount, 0) / closedLoans.length
      : 350000;

  // Historical close rate: closed / all leads ever created
  const { count: totalLeadsEver } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', org.id);

  const avgHistoricalCloseRate =
    (totalLeadsEver ?? 0) > 0
      ? closedLoans.length / (totalLeadsEver ?? 1)
      : 0.35;

  // Compensation + goal come from the LO's own profile (Settings → Profile).
  // comp_rate is stored as a percent (e.g. 1.25 = 1.25%); revenue math wants
  // basis points, so ×100. monthly_volume_goal is already a dollar figure.
  // Read with the admin client — profiles aren't readable under the anon/RLS
  // client in this Clerk app (RLS keys off auth.uid(), which is never set).
  const { data: profile } = await createAdminClient()
    .from('profiles')
    .select('comp_rate, monthly_volume_goal')
    .eq('clerk_user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle();

  const orgSettings = {
    basis_points: profile?.comp_rate != null ? Math.round(profile.comp_rate * 100) : 100,
    monthly_goal: profile?.monthly_volume_goal ?? 3_000_000,
  };

  return (
    <RevenueClient
      closedLoans={closedLoans}
      activeLeadsCount={activeLeadsCount ?? 0}
      avgHistoricalCloseRate={Math.min(1, avgHistoricalCloseRate)}
      avgLoanSize={avgLoanSize}
      orgSettings={orgSettings}
    />
  );
}