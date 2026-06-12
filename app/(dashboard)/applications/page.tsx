import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { getTRIDStatus } from '@/lib/compliance/trid';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Applications' };

const APPLICATION_STAGES = ['application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close'];

export default async function ApplicationsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const { data: org } = await sb
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', orgId)
    .maybeSingle();

  const { data: leads } = await sb
    .from('leads')
    .select('id, first_name, last_name, stage, loan_type, loan_amount, application_submitted_at, loan_estimate_sent_at, closing_disclosure_sent_at, closing_date, le_deadline, cd_deadline')
    .eq('org_id', org?.id ?? '')
    .in('stage', APPLICATION_STAGES)
    .order('application_submitted_at', { ascending: true });

  const STAGE_LABELS: Record<string, string> = {
    application: 'Application',
    processing: 'Processing',
    underwriting: 'Underwriting',
    conditional_approval: 'Cond. Approval',
    clear_to_close: 'Clear to Close',
  };

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-black tracking-tight">Applications</h1>
          <p className="text-label-2 text-sm mt-0.5">
            {(leads ?? []).length} in-process loans · TRID compliance tracking
          </p>
        </div>
        <Link href="/applications/recovery" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-btn text-[13px] font-medium border border-border text-black hover:bg-fill transition-colors whitespace-nowrap">
          Application recovery →
        </Link>
      </div>

      <div className="bg-surface rounded-card shadow-card border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-5 py-3">Borrower</th>
              <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">Stage</th>
              <th className="text-right text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">Loan Amt</th>
              <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">App Date</th>
              <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">LE Status</th>
              <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">CD Status</th>
              <th className="text-left text-[11px] font-semibold text-label-2 uppercase tracking-wide px-3 py-3">Closing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(leads ?? []).map((lead) => {
              const trid = getTRIDStatus(lead as Parameters<typeof getTRIDStatus>[0]);

              const tridStatusClass = (status: string) => {
                switch (status) {
                  case 'ok': return 'text-green';
                  case 'due_today': return 'text-orange font-semibold';
                  case 'overdue': return 'text-red font-semibold';
                  case 'blocked': return 'text-red font-semibold';
                  default: return 'text-label-3';
                }
              };

              const tridStatusLabel = (status: string) => {
                switch (status) {
                  case 'ok': return '✓ OK';
                  case 'due_today': return '⚠ Due Today';
                  case 'overdue': return '✗ Overdue';
                  case 'blocked': return '✗ Blocked';
                  default: return '—';
                }
              };

              return (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}?tab=trid`}
                  className="table-row hover:bg-fill transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-black">
                      {lead.first_name} {lead.last_name}
                    </p>
                    <p className="text-xs text-label-2">
                      {lead.loan_type?.toUpperCase() ?? '—'}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant="info" size="sm">
                      {STAGE_LABELS[lead.stage] ?? lead.stage}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-mono tabular-nums text-black">
                    {lead.loan_amount ? `$${lead.loan_amount.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-3 py-3 text-xs text-label-2">
                    {lead.application_submitted_at
                      ? format(new Date(lead.application_submitted_at), 'MMM d')
                      : '—'}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs ${tridStatusClass(trid.le)}`}>
                      {tridStatusLabel(trid.le)}
                    </span>
                    {trid.le_days_remaining !== null && (
                      <span className="text-[10px] text-label-3 ml-1">
                        ({trid.le_days_remaining}d)
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs ${tridStatusClass(trid.cd)}`}>
                      {tridStatusLabel(trid.cd)}
                    </span>
                    {trid.cd_days_remaining !== null && (
                      <span className="text-[10px] text-label-3 ml-1">
                        ({trid.cd_days_remaining}d)
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-label-2">
                    {lead.closing_date
                      ? format(new Date(lead.closing_date), 'MMM d, yyyy')
                      : '—'}
                  </td>
                </Link>
              );
            })}
          </tbody>
        </table>

        {(leads ?? []).length === 0 && (
          <div className="px-5 py-10 text-center text-label-2 text-sm">
            No applications in progress. Leads advance here from the Pre-Qual stage.
          </div>
        )}
      </div>
    </div>
  );
}