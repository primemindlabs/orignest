import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import { ProcessingWorkspace } from '@/components/processing/ProcessingWorkspace';

export const metadata: Metadata = { title: 'Processing' };

export default async function ProcessingPage() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect('/sign-in');

  const sb = createClient();

  // Fetch all leads currently in processing/underwriting/conditional_approval/clear_to_close
  const { data: leads } = await sb
    .from('leads')
    .select(
      `id, first_name, last_name, loan_type, stage,
       created_at, updated_at, assigned_to,
       profiles:assigned_to ( first_name, last_name )`
    )
    .eq('org_id', orgId)
    .in('stage', ['processing', 'underwriting', 'conditional_approval', 'clear_to_close'])
    .order('updated_at', { ascending: false });

  // Fetch open condition counts per lead
  const leadIds = (leads ?? []).map((l) => l.id);

  const { data: conditionCounts } = leadIds.length
    ? await sb
        .from('loan_conditions')
        .select('lead_id, id')
        .eq('org_id', orgId)
        .in('lead_id', leadIds)
        .not('status', 'in', '("cleared","suspended")')
    : { data: [] };

  const openByLead: Record<string, number> = {};
  for (const c of conditionCounts ?? []) {
    openByLead[c.lead_id] = (openByLead[c.lead_id] ?? 0) + 1;
  }

  // KPI: total open conditions
  const totalOpenConditions = Object.values(openByLead).reduce((a, b) => a + b, 0);

  // KPI: avg days in processing
  const now = Date.now();
  const avgDays =
    leads && leads.length > 0
      ? Math.round(
          leads.reduce((sum, l) => {
            const days = (now - new Date(l.created_at).getTime()) / 86400000;
            return sum + days;
          }, 0) / leads.length
        )
      : 0;

  // KPI: CTC this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const ctcThisWeek = (leads ?? []).filter(
    (l) => l.stage === 'clear_to_close' && new Date(l.updated_at) >= weekAgo
  ).length;

  // Fetch profiles for LO filter
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('org_id', orgId)
    .in('role', ['loan_officer', 'branch_manager', 'admin'])
    .eq('active', true);

  return (
    <ProcessingWorkspace
      leads={leads ?? []}
      openByLead={openByLead}
      kpis={{
        filesInProcessing: (leads ?? []).length,
        totalOpenConditions,
        avgDaysInProcessing: avgDays,
        ctcThisWeek,
      }}
      profiles={profiles ?? []}
    />
  );
}
