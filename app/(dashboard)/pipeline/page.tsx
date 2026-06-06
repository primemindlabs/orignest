import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/Badge';
import { AlertTriangle, Plus } from 'lucide-react';
import Link from 'next/link';
import { getTRIDStatus } from '@/lib/compliance/trid';
import { formatDistanceToNow } from 'date-fns';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Pipeline' };

const STAGES = [
  'new_inquiry',
  'pre_qual',
  'application',
  'processing',
  'underwriting',
  'conditional_approval',
  'clear_to_close',
] as const;

const STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'New Inquiry',
  pre_qual: 'Pre-Qual',
  application: 'Application',
  processing: 'Processing',
  underwriting: 'Underwriting',
  conditional_approval: 'Cond. Approval',
  clear_to_close: 'Clear to Close',
};

const STAGE_BADGE_VARIANT: Record<string, 'info' | 'warning' | 'success' | 'danger' | 'neutral' | 'gold'> = {
  new_inquiry: 'neutral',
  pre_qual: 'info',
  application: 'info',
  processing: 'info',
  underwriting: 'warning',
  conditional_approval: 'warning',
  clear_to_close: 'gold',
};

const STAGE_COLORS: Record<string, string> = {
  new_inquiry: 'border-t-label-2',
  pre_qual: 'border-t-blue',
  application: 'border-t-blue',
  processing: 'border-t-blue',
  underwriting: 'border-t-orange',
  conditional_approval: 'border-t-orange',
  clear_to_close: 'border-t-gold',
};

export default async function PipelinePage() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect('/sign-in');

  const sb = createClient();
  const { data: leads } = await sb
    .from('leads')
    .select(
      'id, first_name, last_name, stage, loan_type, loan_amount, lead_source, ai_score, created_at, application_submitted_at, loan_estimate_sent_at, closing_disclosure_sent_at, closing_date'
    )
    .eq('org_id', orgId)
    .in('stage', [...STAGES])
    .order('created_at', { ascending: false });

  const allLeads = leads ?? [];

  // Group by stage
  const byStage: Record<string, typeof allLeads> = {};
  for (const stage of STAGES) {
    byStage[stage] = allLeads.filter((l) => l.stage === stage);
  }

  const totalValue = allLeads.reduce((s, l) => s + (l.loan_amount ?? 0), 0);

  function formatCurrency(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
  }

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-black tracking-tight">Pipeline</h1>
          <p className="text-label-2 text-sm mt-0.5">
            {allLeads.length} active loans · {formatCurrency(totalValue)} total value
          </p>
        </div>
        <Link
          href="/leads/new"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-sm font-medium bg-blue text-white hover:bg-blue/90 transition-colors shadow-sm"
        >
          <Plus size={14} />
          Add Lead
        </Link>
      </div>

      {/* ── Kanban board ─────────────────────────────────────────────── */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const stageLeads = byStage[stage] ?? [];
          const stageValue = stageLeads.reduce((s, l) => s + (l.loan_amount ?? 0), 0);

          return (
            <div
              key={stage}
              className={`flex-shrink-0 w-[240px] bg-fill rounded-card border-t-2 ${STAGE_COLORS[stage]} overflow-hidden`}
            >
              {/* Column header */}
              <div className="px-3 py-3 border-b border-border">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-black">{STAGE_LABELS[stage]}</span>
                  <span className="text-[10px] font-bold text-white bg-label-2/60 rounded-full w-5 h-5 flex items-center justify-center">
                    {stageLeads.length}
                  </span>
                </div>
                {stageValue > 0 && (
                  <p className="text-[10px] text-label-2 mt-0.5 font-mono tabular-nums">
                    {formatCurrency(stageValue)}
                  </p>
                )}
              </div>

              {/* Cards */}
              <div className="p-2 space-y-2 min-h-[120px]">
                {stageLeads.map((lead) => {
                  const trid = getTRIDStatus(lead as Parameters<typeof getTRIDStatus>[0]);
                  const hasTridAlert =
                    trid.le === 'overdue' || trid.le === 'due_today' || trid.cd === 'overdue' || trid.cd === 'blocked';

                  return (
                    <Link
                      key={lead.id}
                      href={`/leads/${lead.id}`}
                      className="block bg-surface rounded-[8px] shadow-card border border-border p-3 hover:shadow-elevated transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <p className="text-[13px] font-medium text-black leading-tight truncate">
                          {lead.first_name} {lead.last_name}
                        </p>
                        {hasTridAlert && (
                          <AlertTriangle size={12} className="text-red flex-shrink-0 mt-0.5" />
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {lead.loan_type && (
                          <span className="text-[10px] bg-fill text-label-2 px-1.5 py-0.5 rounded-full font-medium">
                            {lead.loan_type.toUpperCase()}
                          </span>
                        )}
                        {lead.lead_source && (
                          <span className="text-[10px] text-label-3 truncate">{lead.lead_source}</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-2">
                        {lead.loan_amount ? (
                          <span className="text-[11px] font-mono font-medium text-black tabular-nums">
                            ${lead.loan_amount.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-[11px] text-label-3">Amount TBD</span>
                        )}
                        {lead.ai_score !== null && (
                          <span
                            className={`text-[11px] font-mono font-semibold tabular-nums ${
                              lead.ai_score >= 70
                                ? 'text-green'
                                : lead.ai_score >= 40
                                ? 'text-orange'
                                : 'text-red'
                            }`}
                          >
                            {lead.ai_score}
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] text-label-3 mt-1.5">
                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                      </p>
                    </Link>
                  );
                })}

                {stageLeads.length === 0 && (
                  <div className="flex items-center justify-center py-6 text-[11px] text-label-3">
                    No leads
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
