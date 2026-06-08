import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { CalendarClient } from './CalendarClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Pipeline Calendar' };

export interface CalendarLoan {
  id: string;
  first_name: string;
  last_name: string;
  loan_amount: number | null;
  stage: string;
  closing_date: string | null;
  projected_close_date: string | null;
  assigned_to: string | null;
  loan_type: string | null;
  conditions_count?: number;
}

export interface MonthlySummary {
  month: string; // YYYY-MM
  confirmed: number;
  projected: number;
  total: number;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const now = new Date();
  const targetMonth = searchParams.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, month] = targetMonth.split('-').map(Number);

  // Get loans for target month (closing_date or projected_close_date)
  const monthStart = new Date(year, month - 1, 1).toISOString().slice(0, 10);
  const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10);

  const { data: loans } = await sb
    .from('leads')
    .select('id, first_name, last_name, loan_amount, stage, closing_date, assigned_to, loan_type')
    .eq('org_id', orgId)
    .in('stage', ['clear_to_close', 'closed', 'conditional_approval', 'underwriting', 'processing'])
    .or(
      `and(closing_date.gte.${monthStart},closing_date.lte.${monthEnd})`
    );

  // Also get loans without closing_date but in CTC stage for "projected"
  const { data: ctcLoans } = await sb
    .from('leads')
    .select('id, first_name, last_name, loan_amount, stage, closing_date, assigned_to, loan_type')
    .eq('org_id', orgId)
    .in('stage', ['clear_to_close', 'conditional_approval'])
    .is('closing_date', null)
    .limit(20);

  // Historical monthly summaries (last 6 months) for sparkline
  const summaries: MonthlySummary[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    const mStart = d.toISOString().slice(0, 10);
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
    const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const { data: mLoans } = await sb
      .from('leads')
      .select('loan_amount, stage')
      .eq('org_id', orgId)
      .gte('closing_date', mStart)
      .lte('closing_date', mEnd);

    const closed = (mLoans ?? []).filter((l) => l.stage === 'closed');
    const projected = (mLoans ?? []).filter((l) => l.stage !== 'closed');
    summaries.push({
      month: mKey,
      confirmed: closed.reduce((s, l) => s + (l.loan_amount ?? 0), 0),
      projected: projected.reduce((s, l) => s + (l.loan_amount ?? 0), 0),
      total: (mLoans ?? []).reduce((s, l) => s + (l.loan_amount ?? 0), 0),
    });
  }

  const allLoans: CalendarLoan[] = [...(loans ?? []), ...(ctcLoans ?? [])];

  return (
    <CalendarClient
      loans={allLoans}
      summaries={summaries}
      year={year}
      month={month}
    />
  );
}