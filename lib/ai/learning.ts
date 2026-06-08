/**
 * AI Learning Loop — server-only
 *
 * Builds org-specific context from historical data and exposes
 * helpers used by Claude prompt construction throughout the app.
 * This module is server-only — never import in client components.
 */

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { OrgAIContext, OrgLeadWeights, AIUserAction } from '@/types';

// ─── Record AI interaction + feedback ────────────────────────────────────────

export async function recordAIFeedback(params: {
  orgId: string;
  userId: string;
  leadId?: string;
  agentType: string;
  inputContext: Record<string, unknown>;
  aiOutput: string;
  userAction: AIUserAction;
  finalOutput?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
}): Promise<void> {
  const sb = createAdminClient();

  // Write to ai_interactions (new detailed log)
  await sb.from('ai_interactions').insert({
    org_id: params.orgId,
    user_id: params.userId,
    lead_id: params.leadId ?? null,
    agent_type: params.agentType,
    input_tokens: params.inputTokens ?? null,
    output_tokens: params.outputTokens ?? null,
    latency_ms: params.latencyMs ?? null,
    user_action: params.userAction,
  });

  // Also write to ai_feedback if table exists (legacy + learning)
  await sb.from('ai_feedback').insert({
    org_id: params.orgId,
    user_id: params.userId,
    ai_type: params.agentType as 'lead_score' | 'sms_draft' | 'email_draft' | 'morning_briefing' | 'deal_analysis' | 'conditions_parse',
    input_context: params.inputContext,
    ai_output: params.aiOutput,
    user_action: params.userAction === 'accepted' ? 'accepted'
      : params.userAction === 'rejected' ? 'rejected'
      : params.userAction === 'modified' ? 'edited'
      : 'no_action',
    edited_output: params.finalOutput ?? null,
  }).then(() => undefined).catch(() => undefined); // graceful — table may not exist yet
}

// ─── Record AI input (pre-action) ─────────────────────────────────────────────

type AIFeedbackType =
  | 'lead_score'
  | 'sms_draft'
  | 'email_draft'
  | 'morning_briefing'
  | 'deal_analysis'
  | 'conditions_parse';

/**
 * Log an AI generation as soon as it is produced, before the user has acted on it.
 * The user_action is recorded as 'no_action' and is updated later (accepted /
 * rejected / edited) once the user saves or dismisses the output.
 *
 * Best-effort: never throws — feedback tracking must not block the AI response.
 */
export async function recordAIFeedbackInput(params: {
  orgId: string;
  userId: string;
  aiType: AIFeedbackType;
  inputContext: Record<string, unknown>;
  aiOutput: string;
}): Promise<void> {
  const sb = createAdminClient();

  await sb
    .from('ai_feedback')
    .insert({
      org_id: params.orgId,
      user_id: params.userId,
      ai_type: params.aiType,
      input_context: params.inputContext,
      ai_output: params.aiOutput,
      user_action: 'no_action',
      edited_output: null,
    })
    .then(() => undefined)
    .catch(() => undefined); // graceful — table may not exist yet
}

// ─── Build org-specific context ───────────────────────────────────────────────

export async function buildOrgContext(orgId: string): Promise<OrgAIContext> {
  const sb = createAdminClient();

  const [
    { data: leads },
    { data: conditions },
    { data: aiInsights },
  ] = await Promise.all([
    sb
      .from('leads')
      .select('stage, lead_source, loan_type, ai_score, created_at, closing_date')
      .eq('org_id', orgId)
      .in('stage', ['closed', 'application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close'])
      .gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString()),
    sb
      .from('loan_conditions')
      .select('condition_text, status')
      .eq('org_id', orgId)
      .eq('status', 'outstanding')
      .limit(200),
    sb
      .from('org_ai_insights')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle(),
  ]);

  const allLeads = leads ?? [];
  const closedLeads = allLeads.filter((l) => l.stage === 'closed');

  // Average AI score
  const scores = allLeads.map((l) => l.ai_score).filter((s): s is number => s !== null);
  const avgLeadScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 65;

  // Top lead sources
  const sourceCounts: Record<string, number> = {};
  for (const lead of allLeads) {
    const src = lead.lead_source ?? 'unknown';
    sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
  }
  const topLeadSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([src]) => src);

  // Average days to close
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
    : 35;

  // Top loan types
  const loanTypeCounts: Record<string, number> = {};
  for (const lead of allLeads) {
    const lt = lead.loan_type ?? 'conventional';
    loanTypeCounts[lt] = (loanTypeCounts[lt] ?? 0) + 1;
  }
  const topLoanTypes = Object.entries(loanTypeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([lt]) => lt);

  // Common outstanding conditions (first 5 words of each)
  const conditionTexts = (conditions ?? [])
    .map((c) => c.condition_text.split(' ').slice(0, 6).join(' '))
    .slice(0, 10);
  const uniqueConditions = [...new Set(conditionTexts)];

  // Best contact times from insights table
  const bestContactTimes = aiInsights?.best_contact_hour
    ? [`${aiInsights.best_contact_hour}:00`]
    : ['10:00', '14:00', '17:00'];

  // Conversion rates by stage
  const stageOrder = ['application', 'processing', 'underwriting', 'conditional_approval', 'clear_to_close', 'closed'];
  const conversionRateByStage: Record<string, number> = {};
  for (const stage of stageOrder) {
    const inStage = allLeads.filter((l) => l.stage === stage).length;
    const total = allLeads.length;
    conversionRateByStage[stage] = total > 0 ? Math.round((inStage / total) * 100) : 0;
  }

  return {
    avgLeadScore,
    topLeadSources,
    avgDaysToClose,
    topLoanTypes,
    commonConditions: uniqueConditions,
    bestContactTimes,
    conversionRateByStage,
  };
}

// ─── Calculate org-specific lead scoring weights ──────────────────────────────

export async function calculateOrgLeadWeights(orgId: string): Promise<OrgLeadWeights> {
  const sb = createAdminClient();

  const { data: closedLeads } = await sb
    .from('leads')
    .select('lead_source, loan_type, credit_score')
    .eq('org_id', orgId)
    .eq('stage', 'closed')
    .gte('created_at', new Date(Date.now() - 180 * 86400000).toISOString());

  const leads = closedLeads ?? [];

  // Source weights — how often each source results in a close
  const { data: allSourceLeads } = await sb
    .from('leads')
    .select('lead_source')
    .eq('org_id', orgId)
    .gte('created_at', new Date(Date.now() - 180 * 86400000).toISOString());

  const totalBySource: Record<string, number> = {};
  const closedBySource: Record<string, number> = {};

  for (const lead of allSourceLeads ?? []) {
    const src = lead.lead_source ?? 'unknown';
    totalBySource[src] = (totalBySource[src] ?? 0) + 1;
  }
  for (const lead of leads) {
    const src = lead.lead_source ?? 'unknown';
    closedBySource[src] = (closedBySource[src] ?? 0) + 1;
  }

  const sourceWeights: Record<string, number> = {};
  for (const [src, total] of Object.entries(totalBySource)) {
    const closed = closedBySource[src] ?? 0;
    sourceWeights[src] = total > 0 ? parseFloat((closed / total).toFixed(2)) : 0.1;
  }

  // Loan type weights
  const totalByType: Record<string, number> = {};
  const closedByType: Record<string, number> = {};

  for (const lead of allSourceLeads ?? []) {
    // allSourceLeads doesn't have loan_type — that's ok, use leads
  }
  const { data: allTypeLeads } = await sb
    .from('leads')
    .select('loan_type')
    .eq('org_id', orgId)
    .gte('created_at', new Date(Date.now() - 180 * 86400000).toISOString());

  for (const lead of allTypeLeads ?? []) {
    const lt = lead.loan_type ?? 'conventional';
    totalByType[lt] = (totalByType[lt] ?? 0) + 1;
  }
  for (const lead of leads) {
    const lt = lead.loan_type ?? 'conventional';
    closedByType[lt] = (closedByType[lt] ?? 0) + 1;
  }

  const loanTypeWeights: Record<string, number> = {};
  for (const [lt, total] of Object.entries(totalByType)) {
    const closed = closedByType[lt] ?? 0;
    loanTypeWeights[lt] = total > 0 ? parseFloat((closed / total).toFixed(2)) : 0.1;
  }

  // Credit score weights (bucket analysis)
  const creditBuckets: Record<string, { total: number; closed: number }> = {
    '< 620': { total: 0, closed: 0 },
    '620–679': { total: 0, closed: 0 },
    '680–719': { total: 0, closed: 0 },
    '720–759': { total: 0, closed: 0 },
    '760+': { total: 0, closed: 0 },
  };

  const { data: allCreditLeads } = await sb
    .from('leads')
    .select('credit_score, stage')
    .eq('org_id', orgId)
    .not('credit_score', 'is', null)
    .gte('created_at', new Date(Date.now() - 180 * 86400000).toISOString());

  for (const lead of allCreditLeads ?? []) {
    const score = lead.credit_score as number;
    const bucket = score < 620 ? '< 620'
      : score < 680 ? '620–679'
      : score < 720 ? '680–719'
      : score < 760 ? '720–759'
      : '760+';
    creditBuckets[bucket].total++;
    if (lead.stage === 'closed') creditBuckets[bucket].closed++;
  }

  const creditScoreWeights: Record<string, number> = {};
  for (const [bucket, counts] of Object.entries(creditBuckets)) {
    creditScoreWeights[bucket] = counts.total > 0
      ? parseFloat((counts.closed / counts.total).toFixed(2))
      : 0.05;
  }

  return { sourceWeights, loanTypeWeights, creditScoreWeights };
}

// ─── Build Claude system prompt with org context ──────────────────────────────

export async function buildOrgSystemPrompt(
  orgId: string,
  basePrompt: string
): Promise<string> {
  try {
    const ctx = await buildOrgContext(orgId);
    const contextBlock = [
      `Their top loan types are ${ctx.topLoanTypes.join(', ')}.`,
      `Their average days to close is ${ctx.avgDaysToClose} days.`,
      `Their best lead sources are ${ctx.topLeadSources.join(', ')}.`,
      `Their average AI lead score is ${ctx.avgLeadScore}/100.`,
      ctx.bestContactTimes.length > 0
        ? `Best borrower contact times: ${ctx.bestContactTimes.join(', ')}.`
        : '',
    ]
      .filter(Boolean)
      .join(' ');

    return `${basePrompt}\n\nOrg context: ${contextBlock}`;
  } catch {
    // Context enrichment is best-effort — never block AI calls
    return basePrompt;
  }
}
