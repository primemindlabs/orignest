// Phase 85 — assemble ghost signals for one lead from REAL tables (server-only):
//   last contact  -> leads.last_contacted_at
//   last reply    -> latest inbound_messages.created_at
//   portal login  -> borrower_behavior_scores.days_since_last_login
//   missed calls  -> call_log rows with a no-answer-ish status
//   email opens   -> NOT tracked -> null (never fabricated)

import type { SupabaseClient } from '@supabase/supabase-js';
import { computeGhostScore, type GhostScoreResult } from './score';

const DAY = 86_400_000;
const MISSED_STATUSES = ['no-answer', 'no_answer', 'missed', 'busy', 'failed'];

function daysSince(ts: string | null | undefined): number | null {
  if (!ts) return null;
  const t = new Date(ts).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY);
}

export type GhostAssessment = GhostScoreResult & {
  lead_id: string;
  days_since_contact: number | null;
  last_contact_at: string | null;
};

export async function assessGhost(
  sb: SupabaseClient<any, any, any>,
  orgId: string,
  leadId: string,
): Promise<GhostAssessment | null> {
  const { data: lead } = await sb
    .from('leads')
    .select('id, last_contacted_at')
    .eq('id', leadId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (!lead) return null;

  const [{ data: lastInbound }, { data: behavior }, { data: missed }] = await Promise.all([
    sb.from('inbound_messages').select('created_at').eq('lead_id', leadId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('borrower_behavior_scores').select('days_since_last_login').eq('lead_id', leadId)
      .order('computed_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('call_log').select('id, status').eq('lead_id', leadId).in('status', MISSED_STATUSES),
  ]);

  const result = computeGhostScore({
    daysSinceEmailOpen: null, // email opens not tracked in this app
    daysSinceReply: daysSince(lastInbound?.created_at),
    daysSincePortalLogin: behavior?.days_since_last_login ?? null,
    missedCalls: (missed ?? []).length,
    daysSinceContact: daysSince(lead.last_contacted_at),
  });

  return {
    ...result,
    lead_id: leadId,
    days_since_contact: daysSince(lead.last_contacted_at),
    last_contact_at: lead.last_contacted_at ?? null,
  };
}
