'use client';

import { Settings, RefreshCw, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  agentType: string;
  label: string;
  description: string;
  lastRun?: string;
  metric: string | number;
  metricLabel: string;
  active: boolean;
  icon: React.ElementType;
  iconColor: string;
  schedule: string;
  onToggle: () => void;
  onRunNow?: () => void;
  isRunning?: boolean;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AgentStatusCard({
  label,
  description,
  lastRun,
  metric,
  metricLabel,
  active,
  icon: Icon,
  iconColor,
  schedule,
  onToggle,
  onRunNow,
  isRunning,
}: Props) {
  return (
    <div className={cn('bg-surface rounded-[10px] border shadow-card p-5 flex flex-col gap-4', active ? 'border-black/[0.06]' : 'border-black/[0.04] opacity-60')}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className={cn('w-9 h-9 rounded-[10px] flex items-center justify-center bg-black/[0.04]', iconColor)}>
            <Icon size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-label leading-tight">{label}</h3>
            <p className="text-[11px] text-label-3">{schedule}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className={cn('flex-shrink-0 w-10 h-6 rounded-full transition-colors relative', active ? 'bg-green' : 'bg-black/[0.20]')}
        >
          <span className={cn('absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform', active ? 'translate-x-5' : 'translate-x-1')} />
        </button>
      </div>

      <p className="text-xs text-label-2 leading-relaxed">{description}</p>

      <div className="flex items-center justify-between bg-bg rounded-[8px] px-3 py-2">
        <span className="text-xs text-label-2">{metricLabel}</span>
        <span className="text-sm font-bold text-label">{metric}</span>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-black/[0.06]">
        <div className="flex items-center gap-1.5">
          {isRunning ? (
            <RefreshCw size={13} className="text-blue animate-spin" />
          ) : (
            <CheckCircle size={13} className="text-label-3" />
          )}
          <span className="text-xs text-label-3">
            {isRunning ? 'Running...' : lastRun ? `Last: ${timeAgo(lastRun)}` : 'Not yet run'}
          </span>
        </div>
        <div className="flex gap-1.5">
          <button className="w-7 h-7 rounded-[7px] flex items-center justify-center bg-black/[0.06] text-label-2 hover:bg-black/[0.10]">
            <Settings size={13} />
          </button>
          {onRunNow && (
            <button
              onClick={onRunNow}
              disabled={isRunning || !active}
              className={cn(
                'px-2.5 h-7 rounded-[7px] text-xs font-semibold transition-colors',
                active && !isRunning ? 'bg-navy text-white hover:bg-navy/90' : 'bg-black/[0.06] text-label-3 cursor-not-allowed',
              )}
            >
              {isRunning ? 'Running' : 'Run Now'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
