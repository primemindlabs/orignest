import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import RevenueClient from './RevenueClient';

export const metadata: Metadata = { title: 'Revenue Intelligence' };

export default async function RevenuePage() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect('/sign-in');

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

  // TODO: replace with settings table values when settings UI is built
  const orgSettings = {
    basis_points: 100,
    monthly_goal: 3_000_000,
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
