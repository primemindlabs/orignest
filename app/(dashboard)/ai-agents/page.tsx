import { redirect } from 'next/navigation';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  Sun, Zap, TrendingDown, RefreshCcw, ShieldCheck, Bot, Heart, Database, Network,
  CheckCircle, AlertCircle, MinusCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'AI Agents — AshleyIQ' };

interface RunRow { agent_name: string; status: string; records_processed: number; run_at: string; error_message: string | null }

/** Platform agents. `key` matches the agent_name a cron writes via logAgentRun(). */
const CATALOG: { key: string; label: string; description: string; icon: React.ElementType; iconColor: string; schedule: string }[] = [
  { key: 'campaign_drip', label: 'Campaign Drip', description: 'Personalizes and delivers due campaign steps (SMS/email) with consent + NMLS gating.', icon: Network, iconColor: 'text-blue', schedule: 'Every 15 min' },
  { key: 'speed_to_lead', label: 'Speed-to-Lead', description: 'Sends a compliant first touch to new consented leads within ~1 minute.', icon: Zap, iconColor: 'text-orange-500', schedule: 'Every minute' },
  { key: 'ghost_recovery', label: 'Ghost Recovery', description: 'Re-engages stalled conversations with AI-drafted interventions.', icon: RefreshCcw, iconColor: 'text-purple-500', schedule: 'Hourly' },
  { key: 'rate_watch', label: 'Rate Watch', description: 'Scans the rate environment and flags borrowers who cross alert thresholds.', icon: TrendingDown, iconColor: 'text-blue', schedule: 'Hourly' },
  { key: 'autopilot', label: 'Ashley Autopilot', description: 'Builds the morning action queue: aging conditions, rate locks, birthdays, fallout.', icon: Bot, iconColor: 'text-navy', schedule: 'Daily' },
  { key: 'goldmine', label: 'Database Goldmine', description: 'Weekly past-client reactivation signals (pre-approval expiry, equity, anniversary).', icon: Database, iconColor: 'text-gold', schedule: 'Weekly' },
  { key: 'trid_monitor', label: 'TRID Monitor', description: 'Checks active loans for upcoming LE/CD deadlines and surfaces urgent alerts.', icon: ShieldCheck, iconColor: 'text-red', schedule: 'Daily' },
  { key: 'post_close', label: 'Post-Close Nurture', description: 'Drafts 30/60/90/180-day and anniversary check-ins for LO review.', icon: Heart, iconColor: 'text-red', schedule: 'Daily' },
];

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  completed: { label: 'Healthy', color: 'text-green', icon: CheckCircle },
  failed: { label: 'Failed', color: 'text-red', icon: AlertCircle },
  running: { label: 'Running', color: 'text-blue', icon: RefreshCcw },
  never: { label: 'No runs yet', color: 'text-label-3', icon: MinusCircle },
};

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function MiniBarChart({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {values.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm bg-blue/30" style={{ height: `${Math.max(3, (v / max) * 32)}px` }} />
      ))}
    </div>
  );
}

export default async function AIAgentsPage() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) redirect('/sign-in');
  if (!orgId) redirect('/onboarding');

  const sb = createAdminClient();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();

  let runs: RunRow[] = [];
  try {
    const { data } = await sb
      .from('agent_run_log')
      .select('agent_name, status, records_processed, run_at, error_message')
      .or(`org_id.eq.${orgId},org_id.is.null`)
      .gte('run_at', since)
      .order('run_at', { ascending: false })
      .limit(1000);
    runs = (data ?? []) as RunRow[];
  } catch {
    runs = []; // agent_run_log migration may not be applied yet
  }

  const byAgent = new Map<string, RunRow[]>();
  for (const r of runs) {
    const arr = byAgent.get(r.agent_name) ?? [];
    arr.push(r);
    byAgent.set(r.agent_name, arr);
  }

  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const todays = runs.filter((r) => new Date(r.run_at) >= startToday);
  const runsToday = todays.length;
  const recordsToday = todays.reduce((s, r) => s + (r.records_processed ?? 0), 0);
  const failuresToday = todays.filter((r) => r.status === 'failed').length;

  const dailyCounts = (rows: RunRow[]): number[] => {
    const days = Array(7).fill(0) as number[];
    for (const r of rows) {
      const day = new Date(r.run_at); day.setHours(0, 0, 0, 0);
      const idx = Math.floor((startToday.getTime() - day.getTime()) / 86_400_000);
      if (idx >= 0 && idx < 7) days[6 - idx]++;
    }
    return days;
  };

  const summary = [
    { label: 'Agents', value: CATALOG.length, color: 'text-navy' },
    { label: 'Runs Today', value: runsToday, color: 'text-blue' },
    { label: 'Records Processed Today', value: recordsToday, color: 'text-green' },
    { label: 'Failures Today', value: failuresToday, color: failuresToday > 0 ? 'text-red' : 'text-label-3' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-label tracking-tight">AI Agents</h1>
        <p className="text-sm text-label-2 mt-0.5">Live status from the agent run log. Telemetry appears once each agent records a run.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {summary.map((s) => (
          <div key={s.label} className="bg-surface rounded-[10px] border border-black/[0.06] p-4 shadow-card">
            <div className={cn('text-2xl font-bold mb-1', s.color)}>{s.value.toLocaleString()}</div>
            <div className="text-xs text-label-2">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {CATALOG.map((agent) => {
          const rows = byAgent.get(agent.key) ?? [];
          const last = rows[0];
          const statusKey = last ? (last.status in STATUS_META ? last.status : 'completed') : 'never';
          const meta = STATUS_META[statusKey];
          const StatusIcon = meta.icon;
          const AgentIcon = agent.icon;
          return (
            <div key={agent.key} className="bg-surface rounded-[10px] border border-black/[0.06] shadow-card p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={cn('w-9 h-9 rounded-[10px] flex items-center justify-center bg-black/[0.04]', agent.iconColor)}><AgentIcon size={18} /></div>
                  <div>
                    <h3 className="text-sm font-semibold text-label leading-tight">{agent.label}</h3>
                    <p className="text-[11px] text-label-3">{agent.schedule}</p>
                  </div>
                </div>
                <span className={cn('flex items-center gap-1 text-[11px] font-medium', meta.color)}><StatusIcon size={13} /> {meta.label}</span>
              </div>

              <p className="text-xs text-label-2 leading-relaxed">{agent.description}</p>

              <div className="flex items-center justify-between bg-bg rounded-[8px] px-3 py-2">
                <span className="text-xs text-label-2">Last run records</span>
                <span className="text-sm font-bold text-label">{last ? last.records_processed.toLocaleString() : '—'}</span>
              </div>

              <div>
                <p className="text-[10px] text-label-3 mb-1.5">Last 7 days · {rows.length} run{rows.length === 1 ? '' : 's'}</p>
                <MiniBarChart values={dailyCounts(rows)} />
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-black/[0.06] text-xs text-label-3">
                <span>{last ? `Last: ${timeAgo(last.run_at)}` : 'Never run'}</span>
                {last?.error_message && <span className="text-red truncate max-w-[55%]" title={last.error_message}>{last.error_message}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-surface rounded-[10px] border border-black/[0.06] shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-black/[0.06]">
          <h2 className="text-sm font-semibold text-label">Agent Run Log</h2>
          <p className="text-xs text-label-2 mt-0.5">Recent activity across all AI agents (last 7 days)</p>
        </div>
        {runs.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-label-3">No agent runs recorded yet.</div>
        ) : (
          <div className="divide-y divide-black/[0.06]">
            {runs.slice(0, 20).map((run, idx) => {
              const label = CATALOG.find((c) => c.key === run.agent_name)?.label ?? run.agent_name;
              const ok = run.status === 'completed';
              return (
                <div key={idx} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-2 h-2 rounded-full', ok ? 'bg-green' : run.status === 'failed' ? 'bg-red' : 'bg-blue')} />
                    <div>
                      <p className="text-sm font-medium text-label">{label}</p>
                      <p className="text-xs text-label-3">{run.records_processed} records{run.error_message ? ` · ${run.error_message}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', ok ? 'bg-green/10 text-green' : run.status === 'failed' ? 'bg-red/10 text-red' : 'bg-blue/10 text-blue')}>{run.status}</span>
                    <span className="text-xs text-label-3">{timeAgo(run.run_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
