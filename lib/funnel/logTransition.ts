/**
 * Phase 99 — append a stage_transitions audit row. INSERT-only; best-effort.
 * Computes days_in_prior_stage from the lead's most recent transition (or the
 * lead's stage_changed_at as a fallback). Call AFTER the stage write succeeds.
 */
import { createAdminClient } from '@/lib/supabase/admin';

type Admin = ReturnType<typeof createAdminClient>;
const DAY = 86_400_000;

export async function logStageTransition(
  sb: Admin,
  params: { orgId: string; leadId: string; loId: string | null; fromStage: string | null; toStage: string },
): Promise<void> {
  const { orgId, leadId, loId, fromStage, toStage } = params;
  try {
    let daysInPrior: number | null = null;
    if (fromStage) {
      const { data: last } = await sb
        .from('stage_transitions')
        .select('transitioned_at')
        .eq('lead_id', leadId)
        .order('transitioned_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      let since: string | null = (last?.transitioned_at as string | null) ?? null;
      if (!since) {
        const { data: lead } = await sb.from('leads').select('stage_changed_at, created_at').eq('id', leadId).maybeSingle();
        since = (lead?.stage_changed_at as string | null) ?? (lead?.created_at as string | null) ?? null;
      }
      if (since) daysInPrior = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / DAY));
    }

    await sb.from('stage_transitions').insert({
      org_id: orgId,
      lo_id: loId,
      lead_id: leadId,
      from_stage: fromStage,
      to_stage: toStage,
      days_in_prior_stage: daysInPrior,
    });
  } catch (e) {
    console.error('[funnel] logStageTransition failed', e); // never block the stage write
  }

  // Phase 107 — fire milestone automations for the new stage (best-effort; never
  // blocks the stage write). The engine no-ops when there are no matching rules.
  try {
    const { evaluateAutomations } = await import('@/lib/automations/engine');
    await evaluateAutomations(sb, { orgId, leadId, newStage: toStage, loId });
  } catch (e) {
    console.error('[automations] evaluateAutomations failed', e);
  }
}
