/**
 * Phase 128 — daily queue generation. Runs every morning (Vercel cron) for each
 * active Pro+ LO: sweeps all signals, dedupes to one action per entity, sorts by
 * priority, caps at 12 to prevent overwhelm, inserts, and logs a 'generated' audit
 * row per action.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AutopilotAction, DraftAction, LoSignatureContext } from './types';
import { buildSignalContext, type SignalCtx } from './context';
import { detectAgingConditions } from './signals/agingConditions';
import { detectRateLockExpiring } from './signals/rateLockExpiring';
import { detectCoolingRealtors } from './signals/coolingRealtors';
import { detectDormantRealtors } from './signals/dormantRealtors';
import { detectBirthdays } from './signals/birthdays';
import { detectFalloutRisk } from './signals/falloutRisk';
import { detectPostCloseEquity } from './signals/postCloseEquity';
import { detectNewArriveLeads } from './signals/newArriveLeads';

const DETECTORS: { name: string; run: (ctx: SignalCtx) => Promise<DraftAction[]> }[] = [
  { name: 'aging_conditions', run: detectAgingConditions },
  { name: 'rate_lock_expiring', run: detectRateLockExpiring },
  { name: 'cooling_realtors', run: detectCoolingRealtors },
  { name: 'dormant_realtors', run: detectDormantRealtors },
  { name: 'birthdays', run: detectBirthdays },
  { name: 'fallout_risk', run: detectFalloutRisk },
  { name: 'post_close_equity', run: detectPostCloseEquity },
  { name: 'new_arrive_leads', run: detectNewArriveLeads },
];

const MAX_ACTIONS_PER_DAY = 12;

export async function generateDailyQueue(
  sb: SupabaseClient,
  loId: string,
  orgId: string,
  lo: LoSignatureContext,
  targetDate: Date,
): Promise<AutopilotAction[]> {
  const dateStr = targetDate.toISOString().slice(0, 10);

  // Idempotency: if a queue already exists for this LO + date, don't regenerate.
  const { data: existing } = await sb
    .from('autopilot_actions')
    .select('id')
    .eq('lo_id', loId)
    .eq('generated_date', dateStr)
    .limit(1);
  if (existing && existing.length) return [];

  const ctx = await buildSignalContext(sb, loId, orgId, targetDate, lo);

  const raw: DraftAction[] = [];
  for (const d of DETECTORS) {
    try {
      raw.push(...(await d.run(ctx)));
    } catch (e) {
      console.error('[autopilot] signal failed:', d.name, e);
    }
  }

  // Deduplicate: at most one action per entity per day — keep the highest priority.
  const byEntity = new Map<string, DraftAction>();
  for (const a of raw) {
    const cur = byEntity.get(a.entity_id);
    if (!cur || a.priority < cur.priority) byEntity.set(a.entity_id, a);
  }

  const capped = [...byEntity.values()]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_ACTIONS_PER_DAY);
  if (!capped.length) return [];

  const rows = capped.map((a) => ({
    org_id: orgId,
    lo_id: loId,
    action_type: a.action_type,
    signal_type: a.signal_type,
    signal_reason: a.signal_reason,
    recommended_content: a.recommended_content ?? null,
    recommended_subject: a.recommended_subject ?? null,
    entity_type: a.entity_type,
    entity_id: a.entity_id,
    entity_name: a.entity_name,
    loan_id: a.loan_id ?? null,
    priority: a.priority,
    status: 'pending' as const,
    generated_date: dateStr,
  }));

  const { data, error } = await sb.from('autopilot_actions').insert(rows).select();
  if (error) throw error;
  const inserted = (data ?? []) as AutopilotAction[];

  if (inserted.length) {
    await sb.from('autopilot_audit_log').insert(
      inserted.map((a) => ({
        org_id: orgId,
        lo_id: loId,
        autopilot_action_id: a.id,
        event: 'generated' as const,
      })),
    );
  }

  return inserted;
}
