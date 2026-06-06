import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProcessorDashboard } from '@/components/processor/ProcessorDashboard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Processor Dashboard — Orignest' };

export default async function ProcessorPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const sb = createAdminClient();

  // ── Load all active processor assignments ──────────────────────────────────
  const { data: assignments } = await sb
    .from('processor_assignments')
    .select('id, org_id, status, permissions, accepted_at, created_at')
    .eq('processor_clerk_id', userId)
    .in('status', ['active', 'pending'])
    .order('created_at', { ascending: false });

  const allAssignments = assignments ?? [];

  // ── Load org details for each assignment ───────────────────────────────────
  const orgIds = allAssignments.map((a) => a.org_id);

  let orgs: { id: string; name: string; nmls_company_id: string | null }[] = [];
  if (orgIds.length > 0) {
    const { data } = await sb
      .from('organizations')
      .select('id, name, nmls_company_id')
      .in('id', orgIds);
    orgs = data ?? [];
  }

  const orgMap = Object.fromEntries(orgs.map((o) => [o.id, o]));

  // ── Load all active file assignments ────────────────────────────────────────
  const { data: fileAssignments } = await sb
    .from('processor_file_assignments')
    .select('lead_id, org_id, assigned_at')
    .eq('processor_clerk_id', userId)
    .eq('active', true);

  const leadIds = (fileAssignments ?? []).map((fa) => fa.lead_id);

  // ── Load leads ──────────────────────────────────────────────────────────────
  let leads: {
    id: string;
    first_name: string;
    last_name: string;
    loan_type: string | null;
    loan_amount: number | null;
    stage: string;
    created_at: string;
    closing_date: string | null;
    org_id: string;
  }[] = [];

  if (leadIds.length > 0) {
    const { data } = await sb
      .from('leads')
      .select(
        'id, first_name, last_name, loan_type, loan_amount, stage, created_at, closing_date, org_id'
      )
      .in('id', leadIds)
      .in('stage', [
        'application',
        'processing',
        'underwriting',
        'conditional_approval',
        'clear_to_close',
      ]);
    leads = data ?? [];
  }

  // ── Fetch open condition counts per lead ────────────────────────────────────
  let openByLead: Record<string, number> = {};
  if (leadIds.length > 0) {
    const { data: conditions } = await sb
      .from('loan_conditions')
      .select('lead_id')
      .in('lead_id', leadIds)
      .not('status', 'in', '("cleared","waived")');

    for (const c of conditions ?? []) {
      openByLead[c.lead_id] = (openByLead[c.lead_id] ?? 0) + 1;
    }
  }

  // ── Fetch LO profiles across all orgs ──────────────────────────────────────
  const leadOrgIds = [...new Set(leads.map((l) => l.org_id))];
  let loProfiles: { id: string; first_name: string; last_name: string; org_id: string }[] = [];
  if (leadOrgIds.length > 0) {
    const { data } = await sb
      .from('profiles')
      .select('id, first_name, last_name, org_id')
      .in('org_id', leadOrgIds)
      .in('role', ['admin', 'branch_manager', 'loan_officer']);
    loProfiles = (data ?? []) as typeof loProfiles;
  }

  return (
    <ProcessorDashboard
      assignments={allAssignments.map((a) => ({
        ...a,
        orgName: orgMap[a.org_id]?.name ?? 'Unknown',
      }))}
      leads={leads}
      openByLead={openByLead}
      orgMap={orgMap}
      loProfiles={loProfiles}
    />
  );
}
