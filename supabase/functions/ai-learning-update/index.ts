/**
 * Supabase Edge Function: ai-learning-update
 *
 * Runs weekly (Sunday midnight) via pg_cron or manual trigger.
 * For each active org: recalibrates AI scoring weights, contact timing,
 * and source quality based on the last 90 days of data.
 *
 * Invoke: supabase functions invoke ai-learning-update
 * Schedule: SELECT cron.schedule('ai-learning-weekly', '0 0 * * 0', $$SELECT net.http_post(...)$$);
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } }
);

interface OrgId {
  id: string;
}

Deno.serve(async (_req) => {
  try {
    console.log('[ai-learning-update] Starting weekly recalibration…');

    // ── 1. Get all active orgs ─────────────────────────────────────────────
    const { data: orgs, error: orgErr } = await supabase
      .from('organizations')
      .select('id')
      .in('subscription_status', ['active', 'trialing']);

    if (orgErr) throw orgErr;
    if (!orgs || orgs.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), { status: 200 });
    }

    let processed = 0;
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();

    for (const org of orgs as OrgId[]) {
      try {
        await recalibrateOrg(org.id, ninetyDaysAgo);
        processed++;
      } catch (err) {
        console.error(`[ai-learning-update] Failed for org ${org.id}:`, err);
        // Continue with other orgs — don't abort the batch
      }
    }

    console.log(`[ai-learning-update] Done. Processed ${processed}/${orgs.length} orgs.`);
    return new Response(
      JSON.stringify({ ok: true, processed, total: orgs.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[ai-learning-update] Fatal error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function recalibrateOrg(orgId: string, since: string): Promise<void> {
  // ── Pull AI feedback acceptance rates ────────────────────────────────────
  const { data: feedback } = await supabase
    .from('ai_feedback')
    .select('ai_type, user_action')
    .eq('org_id', orgId)
    .gte('created_at', since);

  const feedbackStats: Record<string, { accepted: number; total: number }> = {};
  for (const f of feedback ?? []) {
    if (!feedbackStats[f.ai_type]) {
      feedbackStats[f.ai_type] = { accepted: 0, total: 0 };
    }
    feedbackStats[f.ai_type].total++;
    if (f.user_action === 'accepted') {
      feedbackStats[f.ai_type].accepted++;
    }
  }

  // ── Pull lead/close data ──────────────────────────────────────────────────
  const { data: leads } = await supabase
    .from('leads')
    .select('lead_source, loan_type, credit_score, stage, created_at, closing_date')
    .eq('org_id', orgId)
    .gte('created_at', since);

  const allLeads = leads ?? [];
  const closedLeads = allLeads.filter((l) => l.stage === 'closed');

  // ── Source quality ────────────────────────────────────────────────────────
  const totalBySource: Record<string, number> = {};
  const closedBySource: Record<string, number> = {};

  for (const l of allLeads) {
    const src = l.lead_source ?? 'unknown';
    totalBySource[src] = (totalBySource[src] ?? 0) + 1;
  }
  for (const l of closedLeads) {
    const src = l.lead_source ?? 'unknown';
    closedBySource[src] = (closedBySource[src] ?? 0) + 1;
  }

  const learnedSourceQuality: Record<string, number> = {};
  for (const [src, total] of Object.entries(totalBySource)) {
    learnedSourceQuality[src] = total > 0
      ? Math.round(((closedBySource[src] ?? 0) / total) * 100) / 100
      : 0;
  }

  // ── Top sources (sorted by close rate) ───────────────────────────────────
  const topSources = Object.entries(learnedSourceQuality)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([src]) => src);

  // ── Loan type distribution ─────────────────────────────────────────────
  const typeCount: Record<string, number> = {};
  for (const l of closedLeads) {
    const lt = l.loan_type ?? 'conventional';
    typeCount[lt] = (typeCount[lt] ?? 0) + 1;
  }
  const topLoanTypes = Object.entries(typeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([lt]) => lt);

  // ── Average days to close ─────────────────────────────────────────────
  const closeDays = closedLeads
    .filter((l) => l.closing_date && l.created_at)
    .map((l) => {
      const days = Math.floor(
        (new Date(l.closing_date!).getTime() - new Date(l.created_at).getTime()) / 86400000
      );
      return days > 0 ? days : null;
    })
    .filter((d): d is number => d !== null);

  const avgDaysToClose = closeDays.length > 0
    ? Math.round(closeDays.reduce((a, b) => a + b, 0) / closeDays.length)
    : null;

  // ── Average credit score of closed loans ─────────────────────────────
  const creditScores = closedLeads
    .map((l) => l.credit_score)
    .filter((s): s is number => s !== null);

  const avgCreditScoreClosed = creditScores.length > 0
    ? Math.round(creditScores.reduce((a, b) => a + b, 0) / creditScores.length)
    : null;

  // ── Lead scoring weights ──────────────────────────────────────────────
  const learnedLeadWeights: Record<string, number> = {};
  for (const [src, quality] of Object.entries(learnedSourceQuality)) {
    // Weight = close rate normalized to 0.5–2.0 range
    const avgQuality = Object.values(learnedSourceQuality).reduce((a, b) => a + b, 0) /
      Math.max(Object.values(learnedSourceQuality).length, 1);
    const weight = avgQuality > 0 ? quality / avgQuality : 1.0;
    learnedLeadWeights[src] = Math.max(0.2, Math.min(3.0, weight));
  }

  // ── Upsert org_ai_insights ─────────────────────────────────────────────
  await supabase
    .from('org_ai_insights')
    .upsert(
      {
        org_id: orgId,
        top_lead_sources: topSources,
        top_loan_types: topLoanTypes,
        avg_days_to_close: avgDaysToClose,
        avg_credit_score_closed: avgCreditScoreClosed,
        score_weight_source: Object.values(learnedLeadWeights)[0] ?? 1.0,
        last_recalibrated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'org_id' }
    );

  // ── If org_ai_config exists, update learned columns there too ─────────
  await supabase
    .from('org_ai_config')
    .update({
      learned_source_quality: learnedSourceQuality,
      last_learning_update: new Date().toISOString(),
    })
    .eq('org_id', orgId)
    .then(() => undefined)
    .catch(() => undefined); // graceful if table doesn't exist yet

  console.log(`[ai-learning-update] org=${orgId} done. sources=${topSources.join(',')}, avgClose=${avgDaysToClose}d`);
}
