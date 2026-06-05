'use client';

import { useState } from 'react';
import { Sun, ChevronDown, ChevronUp, AlertCircle, Clock, Zap, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BriefingData {
  summary: string;
  priorityLeads: Array<{ id: string; name: string; stage: string; aiScore?: number; loanAmount?: number }>;
  tridAlerts: Array<{ leadId: string; name: string; tridStatus: string }>;
  tasksDue: Array<{ id: string; title: string; priority: string }>;
  pipelineStats: { total?: number; noContact?: number; totalVolume?: number };
}

interface Props {
  loName: string;
  briefing?: BriefingData | null;
  isLoading?: boolean;
}

export function MorningBriefing({ loName, briefing, isLoading }: Props) {
  const [expanded, setExpanded] = useState(false);

  const firstName = loName.split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  if (isLoading) {
    return (
      <div className="bg-surface rounded-[10px] border border-black/[0.06] shadow-card p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-[8px] bg-gold/15 flex items-center justify-center">
            <Sun size={16} className="text-gold" />
          </div>
          <div className="flex-1">
            <div className="h-4 w-48 bg-black/[0.08] rounded animate-pulse" />
            <div className="h-3 w-32 bg-black/[0.06] rounded mt-1.5 animate-pulse" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-black/[0.06] rounded w-full animate-pulse" />
          <div className="h-3 bg-black/[0.06] rounded w-4/5 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-[10px] border border-black/[0.06] shadow-card overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-gold/15 flex items-center justify-center flex-shrink-0">
              <Sun size={16} className="text-gold" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-label">{greeting}, {firstName}.</h3>
              <p className="text-[11px] text-label-3">Here's your day.</p>
            </div>
          </div>
          {briefing && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {(briefing.tridAlerts?.length ?? 0) > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red/10 text-red text-[10px] font-semibold">
                  <AlertCircle size={10} />
                  {briefing.tridAlerts.length} TRID
                </span>
              )}
              {(briefing.tasksDue?.length ?? 0) > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange/10 text-orange text-[10px] font-semibold">
                  <Clock size={10} />
                  {briefing.tasksDue.length} tasks
                </span>
              )}
            </div>
          )}
        </div>

        {!briefing ? (
          <div className="bg-bg rounded-[8px] px-4 py-3">
            <p className="text-sm text-label-2">Your morning briefing will appear here at 7am. Run it now from the AI Agents panel.</p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="bg-bg rounded-[8px] px-4 py-3 mb-3">
              <p className="text-sm text-label leading-relaxed whitespace-pre-line">
                {expanded ? briefing.summary : briefing.summary.slice(0, 200) + (briefing.summary.length > 200 ? '...' : '')}
              </p>
            </div>

            {/* Priority actions */}
            {briefing.priorityLeads?.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {briefing.priorityLeads.slice(0, 3).map((lead, idx) => (
                  <div key={lead.id} className="flex items-center gap-2.5 px-3 py-2 bg-bg rounded-[8px]">
                    <span className="w-5 h-5 rounded-full bg-blue/10 text-blue text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-sm text-label flex-1 truncate">{lead.name}</span>
                    <span className="text-[11px] text-label-3">{lead.stage.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Stats strip */}
            {briefing.pipelineStats && (
              <div className="flex items-center gap-4 text-[11px] text-label-3">
                {briefing.pipelineStats.total != null && (
                  <span className="flex items-center gap-1"><Zap size={11} /> {briefing.pipelineStats.total} active leads</span>
                )}
                {(briefing.pipelineStats.noContact ?? 0) > 0 && (
                  <span className="flex items-center gap-1 text-orange"><Clock size={11} /> {briefing.pipelineStats.noContact} need contact</span>
                )}
              </div>
            )}

            {/* Expand */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 mt-3 text-xs text-blue hover:text-blue/80 transition-colors"
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {expanded ? 'Show less' : 'View full briefing'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
