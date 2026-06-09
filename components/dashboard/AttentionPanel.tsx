/**
 * Phase 30.5 + 30.6 — "Needs Attention" dashboard panel.
 *  • At-Risk Borrowers — low behavioral close score (30.5)
 *  • Loans Behind Pace — at_risk/critical velocity predictions (30.6)
 * Server component; renders nothing if both lists are empty.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';
import { AlertTriangle, Clock, ChevronRight } from 'lucide-react';

const ACTIVE_STAGES = ['new_inquiry', 'pre_qual', 'application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close'];

export async function AttentionPanel({ orgId }: { orgId: string }) {
  const sb = createAdminClient();
  const [{ data: scores }, { data: vels }] = await Promise.all([
    sb.from('borrower_behavior_scores').select('lead_id, score, score_components').eq('org_id', orgId).eq('tier', 'at_risk').order('score', { ascending: true }).limit(12),
    sb.from('velocity_predictions').select('lead_id, predicted_close_date, risk_level, recommendation, generated_at').eq('org_id', orgId).in('risk_level', ['at_risk', 'critical']).order('generated_at', { ascending: false }),
  ]);

  // Latest velocity per lead.
  const latestVel: Record<string, { predicted_close_date: string; risk_level: string; recommendation: string | null }> = {};
  for (const r of vels ?? []) if (!latestVel[r.lead_id]) latestVel[r.lead_id] = { predicted_close_date: r.predicted_close_date, risk_level: r.risk_level, recommendation: r.recommendation };

  const leadIds = Array.from(new Set([...(scores ?? []).map((s) => s.lead_id), ...Object.keys(latestVel)]));
  if (leadIds.length === 0) return null;

  const { data: leads } = await sb
    .from('leads')
    .select('id, first_name, last_name, stage')
    .in('id', leadIds)
    .eq('org_id', orgId)
    .in('stage', ACTIVE_STAGES);
  const leadById: Record<string, { name: string }> = {};
  for (const l of leads ?? []) leadById[l.id] = { name: `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || 'Borrower' };

  const atRisk = (scores ?? []).filter((s) => leadById[s.lead_id]).slice(0, 5);
  const behind = Object.entries(latestVel).filter(([id]) => leadById[id]).slice(0, 5);
  if (atRisk.length === 0 && behind.length === 0) return null;

  function topWeakness(components: Record<string, number> | null | undefined): string {
    if (!components) return 'low engagement';
    const labels: Record<string, string> = { engagement: 'not logging in', responsiveness: 'slow to reply', document_speed: 'docs outstanding', recency: 'inactive', education: '' };
    const entry = Object.entries(components).filter(([k]) => k !== 'education').sort((a, b) => a[1] - b[1])[0];
    return entry ? labels[entry[0]] ?? 'low engagement' : 'low engagement';
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
      {atRisk.length > 0 && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--c-border)] flex items-center gap-2">
            <AlertTriangle size={15} className="text-red" />
            <p className="text-[13px] font-semibold text-[var(--c-text)]">At-Risk Borrowers</p>
            <span className="text-[11px] text-[var(--c-label2)]">· {atRisk.length}</span>
          </div>
          <div className="divide-y divide-[var(--c-border)]">
            {atRisk.map((s) => (
              <Link key={s.lead_id} href={`/loans/${s.lead_id}/portal-comms/borrower-portal`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--c-fill)] transition-colors">
                <span className="text-[13px] font-mono tabular-nums font-semibold text-red w-7">{s.score}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-[var(--c-text)] truncate">{leadById[s.lead_id].name}</p>
                  <p className="text-[11px] text-[var(--c-label2)]">{topWeakness(s.score_components as Record<string, number>)}</p>
                </div>
                <ChevronRight size={15} className="text-[var(--c-label3)]" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {behind.length > 0 && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--c-border)] flex items-center gap-2">
            <Clock size={15} className="text-orange" />
            <p className="text-[13px] font-semibold text-[var(--c-text)]">Loans Behind Pace</p>
            <span className="text-[11px] text-[var(--c-label2)]">· {behind.length}</span>
          </div>
          <div className="divide-y divide-[var(--c-border)]">
            {behind.map(([id, v]) => (
              <Link key={id} href={`/loans/${id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--c-fill)] transition-colors">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${v.risk_level === 'critical' ? 'bg-red' : 'bg-orange'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-[var(--c-text)] truncate">{leadById[id].name}</p>
                  <p className="text-[11px] text-[var(--c-label2)] truncate">{v.recommendation || `Predicted close ${new Date(v.predicted_close_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}</p>
                </div>
                <ChevronRight size={15} className="text-[var(--c-label3)]" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
