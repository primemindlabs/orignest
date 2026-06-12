/**
 * Phase 129 — compact File Intelligence row shown under a borrower's name in the
 * pipeline list: health, close %, predicted close date, and active-risk count.
 */
import { IconHeartbeat, IconTarget, IconCalendar } from '@tabler/icons-react';
import { format } from 'date-fns';
import type { LoanIntelligenceScores } from '@/lib/intelligence/types';

type Props = { scores: LoanIntelligenceScores };

const fmt = (d: string) => format(new Date(d), 'MMM d');

export function IntelligenceRow({ scores }: Props) {
  const healthColor =
    scores.file_health_score >= 75 ? '#1A7A45'
    : scores.file_health_score >= 50 ? '#C9A95C'
    : '#C4724A';
  const flags = scores.fallout_flags ?? [];

  return (
    <div className="flex items-center gap-4 mt-1.5 flex-wrap">
      {/* Health Score */}
      <div className="flex items-center gap-1.5 text-xs">
        <IconHeartbeat size={12} style={{ color: healthColor }} />
        <span style={{ color: healthColor, fontFamily: "'DM Mono', monospace" }}>
          {scores.file_health_score}
        </span>
        <span className="text-[#6B7B8D]">health</span>
      </div>

      {/* Close Probability */}
      <div className="flex items-center gap-1.5 text-xs">
        <IconTarget size={12} className="text-[#6B7B8D]" />
        <span className="text-[#4A4A4A]" style={{ fontFamily: "'DM Mono', monospace" }}>
          {Math.round(scores.close_probability * 100)}%
        </span>
        <span className="text-[#6B7B8D]">close</span>
      </div>

      {/* Predicted Close Date */}
      {scores.predicted_close_date && (
        <div className="flex items-center gap-1.5 text-xs">
          <IconCalendar size={12} className="text-[#6B7B8D]" />
          <span className="text-[#4A4A4A]">Est. {fmt(scores.predicted_close_date)}</span>
          {scores.predicted_close_confidence === 'low' && (
            <span className="text-[#C4724A] text-[10px]">low confidence</span>
          )}
        </div>
      )}

      {/* Fallout flags */}
      {flags.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-[#C4724A]">
          <span>⚠️</span>
          <span>{flags.length} risk{flags.length !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
}
