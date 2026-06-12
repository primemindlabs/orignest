'use client';

/**
 * Phase 129 — File Intelligence panel for the loan file detail page.
 * Collapsible: compact header (always visible) + expanded drivers/risks/forecast.
 * Manual refresh re-runs the engine server-side and updates in place.
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { ScoreRing } from '@/components/ui/ScoreRing';
import { FalloutFlagCard } from './FalloutFlagCard';
import { HealthDriverList } from './HealthDriverList';
import { IconChevronDown, IconChevronUp, IconRefreshDot } from '@tabler/icons-react';
import type { LoanIntelligenceScores } from '@/lib/intelligence/types';

type Props = { loanId: string; scores: LoanIntelligenceScores };

const fmt = (d: string) => format(new Date(d), 'MMM d, yyyy');

export function FileIntelligencePanel({ loanId, scores: initial }: Props) {
  const [scores, setScores] = useState<LoanIntelligenceScores>(initial);
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const flags = scores.fallout_flags ?? [];

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/intelligence/refresh?loanId=${loanId}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.scores) setScores(data.scores);
      }
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E8E4DE] overflow-hidden">
      {/* Compact header — always visible */}
      <div
        className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-[#FAFAF8]"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-6 flex-wrap">
          {/* File Health */}
          <div className="flex items-center gap-2">
            <ScoreRing score={scores.file_health_score} size={36} />
            <div>
              <p className="text-xs text-[#6B7B8D]">File Health</p>
              <p className="text-sm font-semibold text-[#1A1A1A]" style={{ fontFamily: "'DM Mono', monospace" }}>
                {scores.file_health_score}/100
              </p>
            </div>
          </div>

          {/* Close Probability */}
          <div>
            <p className="text-xs text-[#6B7B8D]">Close Probability</p>
            <p className="text-sm font-semibold text-[#1A1A1A]" style={{ fontFamily: "'DM Mono', monospace" }}>
              {Math.round(scores.close_probability * 100)}%
            </p>
          </div>

          {/* UW Readiness */}
          <div>
            <p className="text-xs text-[#6B7B8D]">UW Readiness</p>
            <p className="text-sm font-semibold text-[#1A1A1A]" style={{ fontFamily: "'DM Mono', monospace" }}>
              {scores.uw_readiness_score}/100
            </p>
          </div>

          {/* Predicted Close */}
          {scores.predicted_close_date && (
            <div>
              <p className="text-xs text-[#6B7B8D]">Est. Close</p>
              <p className="text-sm font-semibold text-[#1A1A1A]">{fmt(scores.predicted_close_date)}</p>
            </div>
          )}

          {/* Active flags */}
          {flags.length > 0 && (
            <div className="bg-[#FFF4F0] px-3 py-1.5 rounded-lg">
              <p className="text-xs font-medium text-[#C4724A]">
                ⚠️ {flags.length} active risk{flags.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); refresh(); }}
            className="text-[#6B7B8D] hover:text-[#1A1A1A] p-1.5 rounded-lg hover:bg-[#F4F2EF]"
            aria-label="Recalculate intelligence"
          >
            <IconRefreshDot size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
          {expanded
            ? <IconChevronUp size={16} className="text-[#6B7B8D]" />
            : <IconChevronDown size={16} className="text-[#6B7B8D]" />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-6 pb-6 border-t border-[#F0EDE8] pt-4 space-y-6">
          {flags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[#6B7B8D] uppercase tracking-wide mb-3">Active Risks</p>
              <div className="space-y-2">
                {flags.map((flag, i) => <FalloutFlagCard key={i} flag={flag} />)}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <HealthDriverList label="What's working" items={scores.health_drivers?.positive ?? []} positive />
            <HealthDriverList label="What's hurting the score" items={scores.health_drivers?.negative ?? []} positive={false} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <HealthDriverList label="Conditions satisfied" items={scores.uw_drivers?.ready ?? []} positive />
            <HealthDriverList label="Still needed for UW" items={scores.uw_drivers?.missing ?? []} positive={false} />
          </div>

          {scores.predicted_close_date && (
            <div className="bg-[#F9F7F4] rounded-xl px-4 py-3">
              <p className="text-xs text-[#6B7B8D] mb-1">Predicted Close Date</p>
              <p className="text-base font-semibold text-[#1A1A1A]">{fmt(scores.predicted_close_date)}</p>
              <p className="text-xs text-[#6B7B8D] mt-0.5">
                Confidence:{' '}
                <span style={{
                  color: scores.predicted_close_confidence === 'high' ? '#1A7A45'
                    : scores.predicted_close_confidence === 'medium' ? '#C9A95C'
                    : '#C4724A',
                }}>
                  {scores.predicted_close_confidence}
                </span>
                {' '}· Based on current stage pace and your org&apos;s avg close time
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
