/**
 * Phase 61.2 — Text-to-Apply lead scoring. PURE. Base 50, adjusted by credit,
 * timeline, employment → 0-100 + hot/warm/cool label.
 */
export function scoreTTASession(responses: Record<string, string>): { score: number; label: string } {
  let s = 50;
  const credit = responses.credit;
  if (credit === 'excellent_760_plus') s += 30;
  else if (credit === 'good_720_759') s += 20;
  else if (credit === 'fair_680_719') s += 10;
  else if (credit === 'challenged_below_640') s -= 20;

  const tl = responses.timeline;
  if (tl === 'ready_now') s += 20;
  else if (tl === '1_3_months') s += 10;
  else if (tl === 'exploring') s -= 10;

  if (responses.employment === 'w2') s += 10;
  else if (responses.employment === 'self_employed') s += 5;

  const score = Math.min(100, Math.max(0, s));
  const label = score >= 85 ? 'Hot Lead' : score >= 70 ? 'Warm Lead' : score >= 50 ? 'Cool Lead' : 'Needs Follow-up';
  return { score, label };
}
