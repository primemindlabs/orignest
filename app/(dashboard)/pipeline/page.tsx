import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/auth/orgContext';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/Badge';
import { AlertTriangle, Plus, Clock, Lock } from 'lucide-react';
import { DemoControls } from '@/components/pipeline/DemoControls';
import { MobilePipelineView } from '@/components/pipeline/MobilePipelineView';
import Link from 'next/link';
import { getTRIDStatus } from '@/lib/compliance/trid';
import { formatDistanceToNow, isThisMonth } from 'date-fns';
import { PipelineCommissionMetric } from './PipelineCommissionMetric';

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
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const [{ data: leads }, { data: slaRows }, { data: scoreRows }, { data: velocityRows }] = await Promise.all([
    sb
      .from('leads')
      .select(
        'id, first_name, last_name, stage, loan_type, loan_amount, lead_source, ai_score, created_at, stage_changed_at, application_submitted_at, loan_estimate_sent_at, closing_disclosure_sent_at, closing_date, data_ownership, is_demo'
      )
      .eq('org_id', orgId)
      .in('stage', [...STAGES])
      .order('created_at', { ascending: false }),
    sb
      .from('stage_sla_config')
      .select('stage, warning_days, critical_days, org_id')
      .or(`org_id.eq.${orgId},org_id.is.null`),
    // Phase 30.5 — behavioral close scores
    sb.from('borrower_behavior_scores').select('lead_id, score, tier').eq('org_id', orgId),
    // Phase 30.6 — velocity predictions (reduced to latest per lead below)
    sb.from('velocity_predictions').select('lead_id, predicted_close_date, risk_level, generated_at').eq('org_id', orgId).order('generated_at', { ascending: false }),
  ]);

  const allLeads = leads ?? [];

  // Phase 30.5 — close score by lead.
  const scoreByLead: Record<string, { score: number; tier: string }> = {};
  for (const r of scoreRows ?? []) scoreByLead[r.lead_id] = { score: r.score, tier: r.tier };

  // Phase 30.6 — latest velocity prediction by lead (rows already sorted desc).
  const velocityByLead: Record<string, { predicted_close_date: string; risk_level: string }> = {};
  for (const r of velocityRows ?? []) {
    if (!velocityByLead[r.lead_id]) velocityByLead[r.lead_id] = { predicted_close_date: r.predicted_close_date, risk_level: r.risk_level };
  }
  const RISK_DOT: Record<string, string> = { on_track: 'bg-green', watch: 'bg-orange', at_risk: 'bg-red', critical: 'bg-red' };
  const TIER_TEXT: Record<string, string> = { high: 'text-green', medium: 'text-orange', at_risk: 'text-red' };

  // Resolve SLA per stage — an org-specific row overrides the platform default.
  const slaByStage: Record<string, { warning: number; critical: number }> = {};
  for (const row of slaRows ?? []) {
    const existing = slaByStage[row.stage];
    // org_id !== null wins; otherwise keep the platform default we already have.
    if (!existing || row.org_id) {
      slaByStage[row.stage] = { warning: row.warning_days, critical: row.critical_days };
    }
  }

  const now = Date.now();
  function stallLevel(lead: { stage: string; stage_changed_at: string | null; created_at: string }):
    | 'critical'
    | 'warning'
    | null {
    const sla = slaByStage[lead.stage];
    if (!sla) return null;
    const since = lead.stage_changed_at ?? lead.created_at;
    const days = (now - new Date(since).getTime()) / 86_400_000;
    if (days >= sla.critical) return 'critical';
    if (days >= sla.warning) return 'warning';
    return null;
  }

  const stalled = allLeads
    .map((l) => ({ lead: l, level: stallLevel(l) }))
    .filter((x): x is { lead: (typeof allLeads)[number]; level: 'critical' | 'warning' } => x.level !== null);
  const criticalCount = stalled.filter((s) => s.level === 'critical').length;
  const warningCount = stalled.filter((s) => s.level === 'warning').length;
  const stallByLead: Record<string, 'critical' | 'warning'> = {};
  for (const s of stalled) stallByLead[s.lead.id] = s.level;

  // Group by stage
  const byStage: Record<string, typeof allLeads> = {};
  for (const stage of STAGES) {
    byStage[stage] = allLeads.filter((l) => l.stage === stage);
  }

  const totalValue = allLeads.reduce((s, l) => s + (l.loan_amount ?? 0), 0);

  // Phase 74 — money bar. Real columns: closing_date (expected close), stage.
  const { data: profileRow } = await sb.from('profiles').select('comp_rate').eq('clerk_user_id', userId).maybeSingle();
  const compRate = Number(profileRow?.comp_rate ?? 0.5);
  const CLOSING_STAGES = ['processing', 'underwriting', 'clear_to_close'];
  const closingThisMonth = allLeads.filter((l) => l.closing_date && isThisMonth(new Date(l.closing_date)) && CLOSING_STAGES.includes(l.stage));
  const closingThisMonthVolume = closingThisMonth.reduce((s, l) => s + (l.loan_amount ?? 0), 0);
  const needsAttentionCount = criticalCount + warningCount;
  function fullCurrency(n: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  }

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

      {/* ── Money bar (Phase 74) — money + urgency always visible ─────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 bg-white border border-[var(--color-border-tertiary)] rounded-[12px] overflow-hidden">
        <div className="px-5 py-4 border-r border-[var(--color-border-tertiary)]">
          <p className="text-xs text-[var(--color-text-secondary)] mb-1">Total pipeline</p>
          <p className="text-[19px] font-medium text-black">{fullCurrency(totalValue)}</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{allLeads.length} active loans</p>
        </div>
        <div className="px-5 py-4 border-r border-[var(--color-border-tertiary)]">
          <p className="text-xs text-[var(--color-text-secondary)] mb-1">Closing this month</p>
          <p className="text-[19px] font-medium text-[#8A6310]">{fullCurrency(closingThisMonthVolume)}</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{closingThisMonth.length} loans</p>
        </div>
        <PipelineCommissionMetric closingVolume={closingThisMonthVolume} initialRate={compRate} />
        <div className="px-5 py-4">
          <p className="text-xs text-[var(--color-text-secondary)] mb-1">Needs attention</p>
          <p className="text-[19px] font-medium text-[#C4724A]">{needsAttentionCount}</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">stalled · {criticalCount} critical</p>
        </div>
      </div>

      {/* ── Demo Mode (Phase 42.4) ───────────────────────────────────── */}
      <DemoControls leadCount={allLeads.length} demoCount={allLeads.filter((l) => (l as { is_demo?: boolean }).is_demo).length} />

      {/* ── Stalled-lead SLA banner (Phase 1.4) ──────────────────────── */}
      {stalled.length > 0 && (
        <div
          className={`rounded-card border p-4 ${
            criticalCount > 0
              ? 'bg-red/5 border-red/30'
              : 'bg-orange/5 border-orange/30'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <Clock
              size={16}
              className={`flex-shrink-0 mt-0.5 ${criticalCount > 0 ? 'text-red' : 'text-orange'}`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-black">
                {stalled.length} loan{stalled.length > 1 ? 's' : ''} stalled past SLA
                {criticalCount > 0 && (
                  <span className="text-red font-medium"> · {criticalCount} critical</span>
                )}
                {warningCount > 0 && (
                  <span className="text-orange font-medium"> · {warningCount} approaching</span>
                )}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {stalled
                  .sort((a, b) => (a.level === 'critical' ? -1 : 1) - (b.level === 'critical' ? -1 : 1))
                  .slice(0, 6)
                  .map(({ lead, level }) => (
                    <Link
                      key={lead.id}
                      href={`/leads/${lead.id}`}
                      className="inline-flex items-center gap-1.5 bg-surface rounded-full border border-border px-2.5 py-1 text-[11px] hover:shadow-card transition-shadow"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          level === 'critical' ? 'bg-red' : 'bg-orange'
                        }`}
                      />
                      <span className="font-medium text-black">
                        {lead.first_name} {lead.last_name}
                      </span>
                      <span className="text-label-3">{STAGE_LABELS[lead.stage]}</span>
                    </Link>
                  ))}
                {stalled.length > 6 && (
                  <span className="inline-flex items-center text-[11px] text-label-2 px-1">
                    +{stalled.length - 6} more
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile list view (Phase 42.6) — kanban is desktop-only ───── */}
      <MobilePipelineView leads={allLeads as never} className="md:hidden" />

      {/* ── Kanban board ─────────────────────────────────────────────── */}
      <div className="hidden md:flex gap-4 overflow-x-auto pb-4">
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
                        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                          {(lead as { data_ownership?: string }).data_ownership === 'lo_personal' && (
                            <Lock size={11} className="text-gold-600" aria-label="Your personal contact" />
                          )}
                          {stallByLead[lead.id] && (
                            <Clock
                              size={12}
                              className={stallByLead[lead.id] === 'critical' ? 'text-red' : 'text-orange'}
                            />
                          )}
                          {hasTridAlert && <AlertTriangle size={12} className="text-red" />}
                        </div>
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

                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <p className="text-[10px] text-label-3">
                          {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                        </p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {velocityByLead[lead.id] && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-label-2 font-mono tabular-nums" title="Predicted close (AI)">
                              <span className={`w-1.5 h-1.5 rounded-full ${RISK_DOT[velocityByLead[lead.id].risk_level] ?? 'bg-label-2'}`} />
                              {new Date(velocityByLead[lead.id].predicted_close_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                          {scoreByLead[lead.id] && (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-mono tabular-nums font-semibold ${TIER_TEXT[scoreByLead[lead.id].tier] ?? 'text-label-2'}`}
                              title="Borrower close score (engagement)"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${scoreByLead[lead.id].tier === 'high' ? 'bg-green' : scoreByLead[lead.id].tier === 'medium' ? 'bg-orange' : 'bg-red'}`} />
                              {scoreByLead[lead.id].score}
                            </span>
                          )}
                        </div>
                      </div>
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