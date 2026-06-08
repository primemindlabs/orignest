'use client';

import { useState } from 'react';
import {
  Bot, Sun, Zap, TrendingDown, ShieldCheck, FileSearch,
  BarChart2, Network, Heart, Star, RefreshCw, Settings,
  CheckCircle, AlertCircle, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type AgentStatus = 'active' | 'idle' | 'running' | 'error';

interface Agent {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  schedule: string;
  status: AgentStatus;
  lastRun: string;
  metric: string;
  metricValue: string | number;
  enabled: boolean;
}

const AGENTS: Agent[] = [
  {
    key: 'morning_briefing',
    label: 'Morning Briefing',
    description: 'Generates a personalized daily briefing for each LO with pipeline priorities, TRID alerts, and action items.',
    icon: Sun,
    iconColor: 'text-gold',
    schedule: 'Daily at 7:00 AM',
    status: 'idle',
    lastRun: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    metric: 'LOs briefed today',
    metricValue: 4,
    enabled: true,
  },
  {
    key: 'speed_to_contact',
    label: 'Speed-to-Contact',
    description: 'Monitors new leads and escalates uncontacted leads at 5 min, then again at 60 min to branch manager.',
    icon: Zap,
    iconColor: 'text-orange',
    schedule: 'Every 5 minutes',
    status: 'active',
    lastRun: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    metric: 'Escalated today',
    metricValue: 2,
    enabled: true,
  },
  {
    key: 'rate_watch',
    label: 'Rate Watch',
    description: 'Scans closed loans hourly for refi opportunities when market rates drop 0.75%+ below original rate.',
    icon: TrendingDown,
    iconColor: 'text-blue',
    schedule: 'Hourly',
    status: 'idle',
    lastRun: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    metric: 'Refi opps found',
    metricValue: 7,
    enabled: true,
  },
  {
    key: 'trid_monitor',
    label: 'TRID Compliance Monitor',
    description: 'Checks all active loans for upcoming LE and CD deadlines. Sends urgent alerts to LOs and managers.',
    icon: ShieldCheck,
    iconColor: 'text-red',
    schedule: 'Daily at 6:00 AM',
    status: 'idle',
    lastRun: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    metric: 'Compliance rate',
    metricValue: '94%',
    enabled: true,
  },
  {
    key: 'document_chase',
    label: 'Document Chase',
    description: 'Automatically sends reminders to borrowers for overdue documents and creates LO tasks for critical delays.',
    icon: FileSearch,
    iconColor: 'text-purple-500',
    schedule: 'Daily at 9:00 AM',
    status: 'idle',
    lastRun: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    metric: 'Reminders sent MTD',
    metricValue: 31,
    enabled: true,
  },
  {
    key: 'deal_analysis',
    label: 'Deal Analysis',
    description: 'On-demand AI underwriting analysis per lead. Provides approval likelihood, top issues, and talking points.',
    icon: BarChart2,
    iconColor: 'text-blue',
    schedule: 'On-demand',
    status: 'idle',
    lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    metric: 'Analyses run MTD',
    metricValue: 18,
    enabled: true,
  },
  {
    key: 'partner_nurture',
    label: 'Partner Nurture',
    description: 'Weekly outreach to referral partners with pipeline updates and check-ins to maintain relationship health.',
    icon: Network,
    iconColor: 'text-green',
    schedule: 'Weekly',
    status: 'idle',
    lastRun: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    metric: 'Partners contacted',
    metricValue: 12,
    enabled: true,
  },
  {
    key: 'post_close_retention',
    label: 'Post-Close Retention',
    description: 'Creates personalized check-in drafts at 30/60/90/180 days and 1-year post-close. LO reviews before sending.',
    icon: Heart,
    iconColor: 'text-red',
    schedule: 'Daily at 10:00 AM',
    status: 'idle',
    lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    metric: 'Outreach sent MTD',
    metricValue: 8,
    enabled: true,
  },
  {
    key: 'lead_score',
    label: 'Lead Scoring',
    description: 'Scores leads 0–100 on new lead creation and stage changes based on loan amount, credit, consent, and source.',
    icon: Star,
    iconColor: 'text-gold',
    schedule: 'On new lead + stage change',
    status: 'active',
    lastRun: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    metric: 'Avg score today',
    metricValue: 71,
    enabled: true,
  },
];

const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: 'Running', color: 'text-green', icon: RefreshCw },
  idle: { label: 'Idle', color: 'text-label-3', icon: CheckCircle },
  running: { label: 'Running', color: 'text-blue', icon: RefreshCw },
  error: { label: 'Error', color: 'text-red', icon: AlertCircle },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Simulated 7-day run history (1 bar per day)
function MiniBarChart({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-blue/30 transition-all"
          style={{ height: `${Math.max(4, (v / max) * 32)}px` }}
        />
      ))}
    </div>
  );
}

export default function AIAgentsPage() {
  const [agents, setAgents] = useState(AGENTS);
  const [runningKeys, setRunningKeys] = useState<Set<string>>(new Set());

  function toggleAgent(key: string) {
    setAgents((prev) => prev.map((a) => (a.key === key ? { ...a, enabled: !a.enabled } : a)));
  }

  async function runNow(key: string) {
    if (runningKeys.has(key)) return;
    setRunningKeys((prev) => new Set([...prev, key]));

    // Simulate run
    await new Promise((res) => setTimeout(res, 2000));

    setAgents((prev) =>
      prev.map((a) =>
        a.key === key ? { ...a, lastRun: new Date().toISOString(), status: 'idle' } : a,
      ),
    );
    setRunningKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
  }

  // Mock 7-day run counts
  const mockHistory = [3, 5, 2, 8, 6, 4, 7];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-label tracking-tight">AI Agents</h1>
        <p className="text-sm text-label-2 mt-0.5">Autonomous agents running in the background so you can focus on closing</p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Active Agents', value: agents.filter((a) => a.enabled).length, color: 'text-green' },
          { label: 'Runs Today', value: 42, color: 'text-blue' },
          { label: 'Actions Taken', value: 89, color: 'text-navy' },
          { label: 'Leads Impacted', value: 31, color: 'text-gold' },
        ].map((s) => (
          <div key={s.label} className="bg-surface rounded-[10px] border border-black/[0.06] p-4 shadow-card">
            <div className={cn('text-2xl font-bold mb-1', s.color)}>{s.value}</div>
            <div className="text-xs text-label-2">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map((agent) => {
          const StatusIcon = STATUS_CONFIG[agent.status].icon;
          const AgentIcon = agent.icon;
          const isRunning = runningKeys.has(agent.key);

          return (
            <div
              key={agent.key}
              className={cn(
                'bg-surface rounded-[10px] border shadow-card p-5 flex flex-col gap-4 transition-opacity',
                agent.enabled ? 'border-black/[0.06]' : 'border-black/[0.04] opacity-60',
              )}
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className={cn('w-9 h-9 rounded-[10px] flex items-center justify-center bg-black/[0.04]', agent.iconColor)}>
                    <AgentIcon size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-label leading-tight">{agent.label}</h3>
                    <p className="text-[11px] text-label-3">{agent.schedule}</p>
                  </div>
                </div>
                {/* Toggle */}
                <button
                  onClick={() => toggleAgent(agent.key)}
                  className={cn(
                    'flex-shrink-0 w-10 h-6 rounded-full transition-colors relative',
                    agent.enabled ? 'bg-green' : 'bg-black/[0.20]',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
                      agent.enabled ? 'translate-x-5' : 'translate-x-1',
                    )}
                  />
                </button>
              </div>

              {/* Description */}
              <p className="text-xs text-label-2 leading-relaxed">{agent.description}</p>

              {/* Metric */}
              <div className="flex items-center justify-between bg-bg rounded-[8px] px-3 py-2">
                <span className="text-xs text-label-2">{agent.metric}</span>
                <span className="text-sm font-bold text-label">{agent.metricValue}</span>
              </div>

              {/* 7-day chart */}
              <div>
                <p className="text-[10px] text-label-3 mb-1.5">Last 7 days</p>
                <MiniBarChart values={mockHistory} />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-1 border-t border-black/[0.06]">
                <div className="flex items-center gap-1.5">
                  <StatusIcon
                    size={13}
                    className={cn(
                      STATUS_CONFIG[agent.status].color,
                      isRunning && 'animate-spin',
                    )}
                  />
                  <span className="text-xs text-label-3">
                    {isRunning ? 'Running...' : `Last: ${timeAgo(agent.lastRun)}`}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button className="w-7 h-7 rounded-[7px] flex items-center justify-center bg-black/[0.06] text-label-2 hover:bg-black/[0.10]">
                    <Settings size={13} />
                  </button>
                  {agent.schedule !== 'On-demand' && agent.schedule !== 'Weekly' && (
                    <button
                      onClick={() => runNow(agent.key)}
                      disabled={isRunning || !agent.enabled}
                      className={cn(
                        'px-2.5 h-7 rounded-[7px] text-xs font-semibold transition-colors',
                        agent.enabled && !isRunning
                          ? 'bg-navy text-white hover:bg-navy/90'
                          : 'bg-black/[0.06] text-label-3 cursor-not-allowed',
                      )}
                    >
                      {isRunning ? 'Running' : 'Run Now'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Agent run log */}
      <div className="bg-surface rounded-[10px] border border-black/[0.06] shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-black/[0.06]">
          <h2 className="text-sm font-semibold text-label">Agent Run Log</h2>
          <p className="text-xs text-label-2 mt-0.5">Recent activity across all AI agents</p>
        </div>
        <div className="divide-y divide-black/[0.06]">
          {[
            { agent: 'Speed-to-Contact', status: 'completed', leads: 1, actions: 1, time: '4 min ago' },
            { agent: 'Lead Scoring', status: 'completed', leads: 1, actions: 1, time: '8 min ago' },
            { agent: 'Rate Watch', status: 'completed', leads: 94, actions: 2, time: '55 min ago' },
            { agent: 'Morning Briefing', status: 'completed', leads: 4, actions: 4, time: '5 hr ago' },
            { agent: 'TRID Monitor', status: 'completed', leads: 8, actions: 2, time: '7 hr ago' },
          ].map((run, idx) => (
            <div key={idx} className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className={cn('w-2 h-2 rounded-full', run.status === 'completed' ? 'bg-green' : 'bg-red')} />
                <div>
                  <p className="text-sm font-medium text-label">{run.agent}</p>
                  <p className="text-xs text-label-3">{run.leads} leads · {run.actions} actions</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', run.status === 'completed' ? 'bg-green/10 text-green' : 'bg-red/10 text-red')}>
                  {run.status}
                </span>
                <span className="text-xs text-label-3">{run.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
