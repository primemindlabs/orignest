/** Phase 74 — per-lead urgency tag. Uses REAL columns (closing_date, stage_changed_at,
 * last_contacted_at, outstanding_conditions_count). No lead-level rate-lock column exists. */
import { differenceInCalendarDays } from 'date-fns';

export interface PipelineLead {
  id: string; first_name: string | null; last_name: string | null; stage: string;
  loan_type: string | null; loan_amount: number | null; loan_purpose: string | null; lead_source: string | null;
  closing_date: string | null; stage_changed_at: string | null; last_contacted_at: string | null; created_at: string;
  outstanding_conditions_count: number;
}

export function LeadAlertTag({ lead }: { lead: PipelineLead }) {
  const now = new Date();
  const terminal = ['closed', 'funded', 'withdrawn', 'declined'].includes(lead.stage);

  if (lead.outstanding_conditions_count > 0) {
    return <span className="text-[10px] font-medium text-[#C4724A]">{lead.outstanding_conditions_count} condition{lead.outstanding_conditions_count !== 1 ? 's' : ''}</span>;
  }
  const lastTouch = lead.last_contacted_at ?? lead.stage_changed_at;
  if (lastTouch && !terminal) {
    const days = differenceInCalendarDays(now, new Date(lastTouch));
    if (days > 5) return <span className="text-[10px] font-medium text-[#C4724A]">Stalled {days}d</span>;
  }
  if (lead.closing_date && !terminal) {
    const days = differenceInCalendarDays(new Date(lead.closing_date), now);
    if (days >= 0 && days <= 14) return <span className="text-[10px] font-medium text-[#065f46]">Closing {days === 0 ? 'today' : `${days}d`}</span>;
  }
  return null;
}
