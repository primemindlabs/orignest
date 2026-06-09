/**
 * Phase 58.3 — Content 360 engagement scoring. PURE.
 * Points per event with a recency multiplier; capped per content type to avoid a
 * single noisy thread dominating. Returns 0-100 score + tier + trend.
 */
export interface EngagementEvent { content_type: string; event_type: string; occurred_at: string; event_metadata?: Record<string, unknown> | null }
export interface EngagementScore { score: number; tier: 'hot' | 'warm' | 'cold' | 'unengaged'; trend: 'up' | 'flat' | 'down' }

const POINTS: Record<string, number> = { opened: 5, clicked: 10, replied: 20, watched: 15, downloaded: 10, shared: 25 };

function recencyMult(occurredAt: string, now: number): number {
  const days = (now - new Date(occurredAt).getTime()) / 86_400_000;
  if (days <= 7) return 1.5;
  if (days <= 30) return 1.0;
  if (days <= 90) return 0.5;
  return 0.2;
}

export function calculateEngagementScore(events: EngagementEvent[], now = Date.now()): EngagementScore {
  // Cap "opened" at 3 counted per content_type (reduce inflation from drip opens).
  const openCountByType = new Map<string, number>();
  let raw = 0;
  for (const e of events) {
    const base = POINTS[e.event_type];
    if (!base) continue;
    if (e.event_type === 'watched' && Number(e.event_metadata?.watch_pct ?? 100) < 50) continue;
    if (e.event_type === 'opened') {
      const c = openCountByType.get(e.content_type) ?? 0;
      if (c >= 3) continue;
      openCountByType.set(e.content_type, c + 1);
    }
    raw += base * recencyMult(e.occurred_at, now);
  }
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const tier: EngagementScore['tier'] = score >= 60 ? 'hot' : score >= 30 ? 'warm' : score > 0 ? 'cold' : 'unengaged';

  // Trend: last-14-days raw vs the prior 14 days.
  const win = (lo: number, hi: number) => events.filter((e) => { const d = (now - new Date(e.occurred_at).getTime()) / 86_400_000; return d >= lo && d < hi && POINTS[e.event_type]; }).length;
  const recent = win(0, 14); const prior = win(14, 28);
  const trend: EngagementScore['trend'] = recent > prior ? 'up' : recent < prior ? 'down' : 'flat';
  return { score, tier, trend };
}
