import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import {
  Users,
  TrendingUp,
  Clock,
  AlertTriangle,
  DollarSign,
  BarChart2,
} from 'lucide-react';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { MetricCard } from '@/components/ui/MetricCard';
import { Badge } from '@/components/ui/Badge';
import { getTRIDStatus } from '@/lib/compliance/trid';
import type { Lead } from '@/types';
import { format, formatDistanceToNow } from 'date-fns';

export const metadata: Metadata = { title: 'Dashboard' };

// Stage ordering and display
const STAGE_LABELS: Record<string, string> = {
  new_inquiry: 'New Inquiry',
  pre_qual: 'Pre-Qual',
  application: 'Application',
  processing: 'Processing',
  underwriting: 'Underwriting',
  conditional_approval: 'Cond. Approval',
  clear_to_close: 'CTC',
  closed: 'Closed',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
};

const STAGE_BADGE_VARIANT: Record<string, 'info' | 'warning' | 'success' | 'danger' | 'neutral' | 'gold'> = {
  new_inquiry: 'neutral',
  pre_qual: 'info',
  application: 'info',
  processing: 'info',
  underwriting: 'warning',
  conditional_approval: 'warning',
  clear_to_close: 'gold',
  closed: 'success',
  declined: 'danger',
  withdrawn: 'neutral',
};

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

export default async function DashboardPage() {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) redirect('/sign-in');

  const sb = createClient();

  // Parallel data fetch
  const [
    { data: profile },
    { data: allLeads },
    { data: recentLeads },
  ] = await Promise.all([
    sb.from('profiles').select('first_name, last_name, role').eq('clerk_user_id', userId).maybeSingle(),
    sb.from('leads').select('id, stage, loan_amount, created_at, first_contacted_at').eq('org_id', orgId),
    sb.from('leads')
      .select('id, first_name, last_name, stage, loan_type, loan_amount, lead_source, ai_score, assigned_to, created_at, application_submitted_at, loan_estimate_sent_at, closing_disclosure_sent_at, closing_date, updated_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const leads = allLeads ?? [];
  const recent = recentLeads ?? [];

  // KPI calculations
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const newTodayCount = leads.filter((l) => l.created_at?.slice(0, 10) === todayStr).length;

  const activeStages = ['new_inquiry', 'pre_qual', 'application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close'];
  const activeLeads = leads.filter((l) => activeStages.includes(l.stage));
  const pipelineValue = activeLeads.reduce((sum, l) => sum + (l.loan_amount ?? 0), 0);

  const closedLeads = leads.filter((l) => l.stage === 'closed');
  const closedThisMonth = closedLeads.filter((l) => {
    const d = new Date(l.created_at);
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });

  // Speed-to-contact: average hours from created to first_contacted (only contacted leads)
  const contactedLeads = leads.filter(
    (l) => l.first_contacted_at && l.created_at
  );
  const speedHours =
    contactedLeads.length > 0
      ? contactedLeads.reduce((sum, l) => {
          const diff =
            new Date(l.first_contacted_at!).getTime() - new Date(l.created_at).getTime();
          return sum + diff / 3_600_000;
        }, 0) / contactedLeads.length
      : null;

  // TRID alerts — leads with application date and compliance issues
  const tridAlerts = recent.filter((l) => {
    if (!l.application_submitted_at) return false;
    const status = getTRIDStatus(l as Parameters<typeof getTRIDStatus>[0]);
    return status.le === 'overdue' || status.le === 'due_today' || status.cd === 'overdue' || status.cd === 'blocked';
  });

  // Pipeline funnel by stage (active only)
  const stageCounts: Record<string, { count: number; value: number }> = {};
  for (const stage of activeStages) {
    const stageLeads = activeLeads.filter((l) => l.stage === stage);
    stageCounts[stage] = {
      count: stageLeads.length,
      value: stageLeads.reduce((s, l) => s + (l.loan_amount ?? 0), 0),
    };
  }
  const maxStageCount = Math.max(...Object.values(stageCounts).map((s) => s.count), 1);

  const firstName = profile?.first_name ?? 'there';
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-[22px] font-bold text-black tracking-tight">
          {greeting}, {firstName}
        </h1>
        <p className="text-label-2 text-sm mt-0.5">
          {format(today, 'EEEE, MMMM d, yyyy')} · Pipeline overview
        </p>
      </div>

      {/* ── TRID Alerts Banner ───────────────────────────────────────── */}
      {tridAlerts.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-card bg-red/5 border border-red/20">
          <AlertTriangle size={18} className="text-red flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red">
              {tridAlerts.length} TRID compliance alert{tridAlerts.length !== 1 ? 's' : ''} require
              immediate attention
            </p>
            <p className="text-xs text-red/80 mt-0.5">
              {tridAlerts.map((l) => `${l.first_name} ${l.last_name}`).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* ── KPI Row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="New Leads Today"
          value={newTodayCount}
          color="blue"
          icon={<Users size={16} />}
        />
        <MetricCard
          label="Pipeline Value"
          value={formatCurrency(pipelineValue)}
          color="gold"
          icon={<DollarSign size={16} />}
        />
        <MetricCard
          label="Closed This Month"
          value={closedThisMonth.length}
          color="green"
          icon={<TrendingUp size={16} />}
        />
        <MetricCard
          label="Avg Speed-to-Contact"
          value={speedHours !== null ? `${speedHours.toFixed(1)}h` : '—'}
          color={speedHours !== null && speedHours > 5 ? 'orange' : 'neutral'}
          icon={<Clock size={16} />}
          deltaInvert
        />
      </div>

      {/* ── Main content: Pipeline funnel + Recent leads ─────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Pipeline funnel */}
        <div className="xl:col-span-1 bg-surface rounded-card shadow-card border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-black">Pipeline Stages</h2>
            <BarChart2 size={16} className="text-label-3" />
          </div>
          <div className="space-y-2.5">
            {activeStages.map((stage) => {
              const { count, value } = stageCounts[stage];
              const width = count === 0 ? 2 : Math.max(4, (count / maxStageCount) * 100);
              return (
                <div key={stage} className="flex items-center gap-3">
                  <span className="text-xs text-label-2 w-28 flex-shrink-0 truncate">
                    {STAGE_LABELS[stage]}
                  </span>
                  <div className="flex-1 h-5 bg-fill rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue rounded-full transition-all duration-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 w-20 flex-shrink-0 justify-end">
                    <span className="text-xs font-medium text-black tabular-nums">{count}</span>
                    {value > 0 && (
                      <span className="text-[10px] text-label-3 tabular-nums">
                        {formatCurrency(value)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-border flex justify-between text-xs text-label-2">
            <span>{activeLeads.length} active loans</span>
            <span className="font-medium text-black">{formatCurrency(pipelineValue)} total</span>
          </div>
        </div>

        {/* Recent leads table */}
        <div className="xl:col-span-2 bg-surface rounded-card shadow-card border border-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-[15px] font-semibold text-black">Recent Leads</h2>
            <a
              href="/leads"
              className="text-xs text-blue hover:underline"
            >
              View all
            </a>
          </div>

          {recent.length === 0 ? (
            <div className="px-5 py-10 text-center text-label-2 text-sm">
              No leads yet. Add your first lead to get started.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recent.map((lead) => {
                const trid = getTRIDStatus(lead as Parameters<typeof getTRIDStatus>[0]);
                const hasTridAlert =
                  trid.le === 'overdue' || trid.le === 'due_today' || trid.cd === 'overdue' || trid.cd === 'blocked';

                return (
                  <a
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-fill transition-colors"
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-blue/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-[12px] font-semibold text-blue">
                        {lead.first_name?.[0]}{lead.last_name?.[0]}
                      </span>
                    </div>

                    {/* Name + source */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-black truncate">
                        {lead.first_name} {lead.last_name}
                      </p>
                      <p className="text-xs text-label-2 truncate">
                        {lead.lead_source ?? 'Direct'} ·{' '}
                        {lead.loan_amount
                          ? formatCurrency(lead.loan_amount)
                          : 'Amount TBD'}
                      </p>
                    </div>

                    {/* Stage badge */}
                    <Badge
                      variant={STAGE_BADGE_VARIANT[lead.stage] ?? 'neutral'}
                      size="sm"
                    >
                      {STAGE_LABELS[lead.stage] ?? lead.stage}
                    </Badge>

                    {/* AI score */}
                    {(lead as Lead).ai_score !== null && (
                      <span className="text-[11px] font-mono font-medium text-label-2 w-8 text-right tabular-nums">
                        {(lead as Lead).ai_score}
                      </span>
                    )}

                    {/* TRID indicator */}
                    {hasTridAlert && (
                      <AlertTriangle size={14} className="text-red flex-shrink-0" />
                    )}

                    {/* Time */}
                    <span className="text-[11px] text-label-3 flex-shrink-0 hidden sm:block">
                      {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
