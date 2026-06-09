/**
 * Phase 29.6 — Relationship health score from retention events (last 180 days).
 */
export interface RetentionEvent { event_type: string; created_at: string }

export interface RelationshipHealth {
  score: number;
  label: 'Strong' | 'Warm' | 'Needs Attention';
  color: 'success' | 'warning' | 'danger';
  last_touch: string | null;
  days_since_last_touch: number | null;
}

const WEIGHTS: Record<string, number> = {
  annual_review_sent: 30,
  annual_review_opened: 20,
  rate_drop_alert: 15,
  portfolio_viewed: 10,
  new_transaction_added: 25,
  refi_inquiry: 35,
};

function isWithin180Days(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() <= 180 * 86_400_000;
}
function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function computeRelationshipHealth(events: RetentionEvent[]): RelationshipHealth {
  const recent = events.filter((e) => isWithin180Days(e.created_at)).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  let score = 0;
  for (const e of recent) score += WEIGHTS[e.event_type] ?? 0;
  score = Math.min(score, 100);
  const lastTouch = recent[0]?.created_at ?? null;
  return {
    score,
    label: score >= 70 ? 'Strong' : score >= 40 ? 'Warm' : 'Needs Attention',
    color: score >= 70 ? 'success' : score >= 40 ? 'warning' : 'danger',
    last_touch: lastTouch,
    days_since_last_touch: daysSince(lastTouch),
  };
}
