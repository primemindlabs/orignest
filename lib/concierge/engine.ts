/**
 * Phase 144 — Ashley Concierge engine. SERVER-ONLY.
 *
 * Drives one inbound borrower message through the conversational agent:
 *   load settings/conversation → assemble context (lead + LO + Brain memories)
 *   → Claude (Sonnet 4.6) manual tool-use loop → compliance guard → TCPA gate → send.
 *
 * Autonomy is opt-in and layered:
 *   off        → returns { handled:false }; the caller keeps its normal behavior.
 *   suggest    → drafts a reply for the LO to approve (never sends).
 *   autonomous → sends the reply, but ONLY after canSendSMS() passes and the
 *                compliance guard is clean; anything else escalates to the LO.
 *
 * Adaptive thinking is intentionally omitted from the request for portability across
 * SDK minor versions; SMS turns are short and don't need it.
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { canSendSMS } from '@/lib/communications/canSendSMS';
import { getEntityMemories } from '@/lib/brain/getEntityMemories';
import { buildSystemPrompt } from '@/lib/concierge/persona';
import { CONCIERGE_TOOLS, executeConciergeTool } from '@/lib/concierge/tools';
import { checkConciergeReply } from '@/lib/concierge/complianceGuard';
import { sendConciergeSms } from '@/lib/concierge/send';
import { enrichPersona } from '@/lib/concierge/enrichPersona';
import { DEFAULT_SETTINGS, type ConciergeContext, type ConciergeResult, type ConciergeSettings, type AutonomyMode, type ToolTrace } from '@/lib/concierge/types';

const MODEL = 'claude-sonnet-4-6';
const MAX_LOOPS = 4;

export interface RunConciergeOpts {
  orgId: string;
  leadId: string;
  loId: string | null;
  inboundText: string;
  channel?: 'sms' | 'email';
  /** Force a mode (used by the simulate endpoint — always 'suggest', never sends). */
  forceMode?: AutonomyMode;
  /** When true, do not persist or send — pure dry run for the test harness. */
  dryRun?: boolean;
}

export async function runConcierge(opts: RunConciergeOpts): Promise<ConciergeResult> {
  const sb = createAdminClient();
  const empty: ConciergeResult = { handled: false, mode: 'off', reply: null, sent: false, escalated: false, toolTrace: [] };
  const text = (opts.inboundText ?? '').trim();
  if (!text) return { ...empty, reason: 'empty inbound' };

  const settings = await loadSettings(sb, opts.orgId, opts.loId);
  if (!settings.enabled && !opts.forceMode) return { ...empty, reason: 'concierge disabled' };

  // ── Conversation row ────────────────────────────────────────────────────────
  const conv = await loadOrCreateConversation(sb, opts, settings, !!opts.dryRun);
  if (!conv) return { ...empty, reason: 'could not open conversation' };
  if (conv.status !== 'active') return { ...empty, mode: conv.autonomy_mode as AutonomyMode, reason: `conversation ${conv.status}` };

  let mode: AutonomyMode = opts.forceMode ?? (conv.autonomy_mode as AutonomyMode);
  if (mode === 'off') return { ...empty, mode, reason: 'autonomy off for this lead' };
  if (mode === 'autonomous' && !settings.allow_autonomous) mode = 'suggest'; // master switch off → draft only

  // Reply cap → hand off to the human.
  if (conv.message_count >= settings.max_ai_replies) {
    if (!opts.dryRun) await escalateConversation(sb, conv.id, opts, 'Reached the AI reply cap for this conversation', `Take over chat with ${(await borrowerFirst(sb, opts))}`);
    return { handled: true, mode, reply: null, sent: false, escalated: true, escalationReason: 'reply cap reached', toolTrace: [] };
  }

  // ── Assemble context ─────────────────────────────────────────────────────────
  const ctx = await buildContext(sb, opts, settings);

  // Persist the inbound borrower turn (so it's in history + the LO can see it).
  if (!opts.dryRun) {
    await sb.from('ai_conversation_messages').insert({ conversation_id: conv.id, org_id: opts.orgId, lead_id: opts.leadId, role: 'borrower', body: text, sent: true, sent_at: new Date().toISOString() }).then(() => undefined, () => undefined);
    await sb.from('ai_conversations').update({ last_inbound_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', conv.id).then(() => undefined, () => undefined);
  }

  const history = await loadHistory(sb, conv.id, text);

  // ── Agent loop ────────────────────────────────────────────────────────────────
  const { reply, toolTrace, escalate } = await runAgentLoop(sb, ctx, history);

  let finalText = (reply || '').trim();
  let escalated = !!escalate;
  let escalationReason = escalate?.reason;

  if (escalated && !finalText) {
    finalText = `Thanks ${ctx.borrowerFirstName}! Let me get ${ctx.loName} to follow up with you on that shortly.`;
  }
  if (!finalText) {
    finalText = `Thanks for reaching out, ${ctx.borrowerFirstName}! ${ctx.loName} will follow up shortly.`;
    escalated = true; escalationReason = escalationReason ?? 'no reply produced';
  }

  // ── Compliance guard (never auto-send a tripped reply) ─────────────────────────
  const guard = checkConciergeReply(finalText);
  let gated = false;
  if (!guard.ok) {
    gated = true;
    escalated = true;
    escalationReason = escalationReason ?? guard.reason;
    finalText = `Great question, ${ctx.borrowerFirstName} — ${ctx.loName} will go over the exact details with you. I'll have them reach out shortly!`;
  }

  // ── Decide send ────────────────────────────────────────────────────────────────
  let sent = false;
  let sendReason: string | undefined;
  if (mode === 'autonomous' && !opts.dryRun) {
    const gate = await canSendSMS(sb, { orgId: opts.orgId, leadId: opts.leadId, category: 'loan_updates' });
    if (gate.allowed) {
      const res = await sendConciergeSms(sb, { orgId: opts.orgId, leadId: opts.leadId, loId: opts.loId, body: finalText });
      sent = res.ok;
      sendReason = res.ok ? undefined : res.reason;
    } else {
      sendReason = gate.reason;
    }
  } else if (mode === 'suggest') {
    sendReason = 'draft awaiting LO approval';
  }

  // ── Persist + bookkeeping ──────────────────────────────────────────────────────
  if (!opts.dryRun) {
    await sb.from('ai_conversation_messages').insert({
      conversation_id: conv.id, org_id: opts.orgId, lead_id: opts.leadId, role: 'assistant',
      body: finalText, tool_trace: toolTrace as unknown as Record<string, unknown>[], gated, gate_reason: gated ? guard.reason : null,
      sent, sent_at: sent ? new Date().toISOString() : null,
    }).then(() => undefined, () => undefined);

    if (sent) {
      await logOutboundComm(sb, opts, finalText);
    } else if (mode === 'suggest' && !escalated) {
      await createApprovalTask(sb, opts, ctx.borrowerFirstName);
    }

    await sb.from('ai_conversations').update({
      message_count: conv.message_count + 1,
      last_ai_reply_at: new Date().toISOString(),
      autonomy_mode: mode,
      status: escalated ? 'escalated' : 'active',
      escalation_reason: escalated ? escalationReason ?? null : conv.escalation_reason,
      escalated_at: escalated ? new Date().toISOString() : conv.escalated_at,
      updated_at: new Date().toISOString(),
    }).eq('id', conv.id).then(() => undefined, () => undefined);

    if (escalated) {
      await escalateTask(sb, opts, ctx.borrowerFirstName, escalationReason ?? 'AI handed off');
    }
  }

  return { handled: true, mode, reply: finalText, sent, escalated, escalationReason, reason: sendReason, toolTrace };
}

// ── Agent loop ──────────────────────────────────────────────────────────────────
async function runAgentLoop(
  sb: ReturnType<typeof createAdminClient>,
  ctx: ConciergeContext,
  history: Anthropic.MessageParam[],
): Promise<{ reply: string; toolTrace: ToolTrace[]; escalate?: { reason: string; category?: string } }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { reply: '', toolTrace: [], escalate: { reason: 'AI not configured (no API key)' } };
  const anthropic = new Anthropic({ apiKey });
  const system = buildSystemPrompt(ctx);
  const msgs: Anthropic.MessageParam[] = [...history];
  const toolTrace: ToolTrace[] = [];
  let escalate: { reason: string; category?: string } | undefined;
  let reply = '';

  for (let i = 0; i < MAX_LOOPS; i++) {
    let resp: Anthropic.Message;
    try {
      resp = await anthropic.messages.create({ model: MODEL, max_tokens: 1024, system, tools: CONCIERGE_TOOLS, messages: msgs });
    } catch (e) {
      console.error('[concierge] model error', e);
      return { reply, toolTrace, escalate: { reason: 'AI request failed', category: 'other' } };
    }

    const textNow = resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join(' ').trim();
    if (textNow) reply = textNow;
    const toolUses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');

    if (resp.stop_reason === 'tool_use' && toolUses.length) {
      msgs.push({ role: 'assistant', content: resp.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const ex = await executeConciergeTool(sb, ctx, tu.name, (tu.input ?? {}) as Record<string, unknown>);
        toolTrace.push({ name: tu.name, input: tu.input, result: ex.result });
        if (ex.escalate) escalate = ex.escalate;
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(ex.result) });
      }
      msgs.push({ role: 'user', content: results });
      if (escalate) break; // handoff requested — stop the loop
      continue;
    }
    break; // end_turn
  }
  return { reply, toolTrace, escalate };
}

// ── Helpers ──────────────────────────────────────────────────────────────────────
type Admin = ReturnType<typeof createAdminClient>;

async function loadSettings(sb: Admin, orgId: string, loId: string | null): Promise<ConciergeSettings> {
  const cols = 'enabled, autonomy_default, allow_autonomous, persona_tone, persona_specialties, products, business_goal, booking_url, application_url, max_ai_replies, custom_instructions';
  let row: Record<string, any> | null = null;
  if (loId) {
    const { data } = await sb.from('ai_concierge_settings').select(cols).eq('org_id', orgId).eq('lo_id', loId).maybeSingle();
    row = data ?? null;
  }
  if (!row) {
    const { data } = await sb.from('ai_concierge_settings').select(cols).eq('org_id', orgId).is('lo_id', null).maybeSingle();
    row = data ?? null;
  }
  const merged = { ...DEFAULT_SETTINGS, ...(row ?? {}) } as ConciergeSettings;
  return enrichPersona(sb, orgId, loId, merged);
}

interface ConvRow { id: string; status: string; autonomy_mode: string; message_count: number; escalation_reason: string | null; escalated_at: string | null; }

async function loadOrCreateConversation(sb: Admin, opts: RunConciergeOpts, settings: ConciergeSettings, dryRun: boolean): Promise<ConvRow | null> {
  const sel = 'id, status, autonomy_mode, message_count, escalation_reason, escalated_at';
  const { data: existing } = await sb.from('ai_conversations').select(sel).eq('org_id', opts.orgId).eq('lead_id', opts.leadId).maybeSingle();
  if (existing) return existing as ConvRow;
  if (dryRun) return { id: 'dry-run', status: 'active', autonomy_mode: opts.forceMode ?? settings.autonomy_default, message_count: 0, escalation_reason: null, escalated_at: null };
  const { data: created } = await sb.from('ai_conversations').insert({
    org_id: opts.orgId, lead_id: opts.leadId, lo_id: opts.loId, channel: opts.channel ?? 'sms',
    autonomy_mode: opts.forceMode ?? settings.autonomy_default, status: 'active',
  }).select(sel).single();
  return (created as ConvRow) ?? null;
}

async function buildContext(sb: Admin, opts: RunConciergeOpts, settings: ConciergeSettings): Promise<ConciergeContext> {
  const [{ data: lead }, { data: org }, lo] = await Promise.all([
    sb.from('leads').select('first_name, loan_purpose, loan_amount, timeline, property_state, loan_type').eq('id', opts.leadId).eq('org_id', opts.orgId).maybeSingle(),
    sb.from('organizations').select('name').eq('id', opts.orgId).maybeSingle(),
    opts.loId ? sb.from('profiles').select('first_name, last_name').eq('id', opts.loId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const loRow = (lo.data ?? {}) as { first_name?: string; last_name?: string };
  const leadRow = (lead ?? {}) as Record<string, any>;

  let memories: string[] = [];
  if (opts.loId) {
    try {
      const mem = await getEntityMemories(sb as any, opts.loId, 'lead' as any, opts.leadId, { limit: 8 });
      memories = mem.map((m: any) => m.memory_text).filter(Boolean);
    } catch { /* Brain optional */ }
  }

  const knownFacts: Record<string, unknown> = {};
  for (const k of ['loan_purpose', 'loan_amount', 'timeline', 'property_state', 'loan_type']) {
    if (leadRow[k] != null && leadRow[k] !== '') knownFacts[k] = leadRow[k];
  }

  return {
    orgId: opts.orgId, leadId: opts.leadId, loId: opts.loId,
    borrowerFirstName: leadRow.first_name || 'there',
    loName: `${loRow.first_name ?? ''} ${loRow.last_name ?? ''}`.trim() || 'your loan officer',
    companyName: ((org ?? {}) as { name?: string }).name || 'our team',
    settings, memories, knownFacts,
  };
}

async function loadHistory(sb: Admin, conversationId: string, currentInbound: string): Promise<Anthropic.MessageParam[]> {
  if (conversationId === 'dry-run') return [{ role: 'user', content: currentInbound }];
  const { data } = await sb.from('ai_conversation_messages')
    .select('role, body, sent').eq('conversation_id', conversationId)
    .order('created_at', { ascending: true }).limit(20);
  const rows = (data ?? []) as { role: string; body: string; sent: boolean }[];
  const msgs: Anthropic.MessageParam[] = [];
  for (const r of rows) {
    if (r.role === 'borrower') msgs.push({ role: 'user', content: r.body });
    else if ((r.role === 'assistant' || r.role === 'lo') && r.sent) msgs.push({ role: 'assistant', content: r.body });
  }
  // Anthropic requires the first turn to be 'user'.
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') msgs.push({ role: 'user', content: currentInbound });
  return msgs;
}

async function borrowerFirst(sb: Admin, opts: RunConciergeOpts): Promise<string> {
  const { data } = await sb.from('leads').select('first_name').eq('id', opts.leadId).maybeSingle();
  return ((data as { first_name?: string } | null)?.first_name) || 'the borrower';
}

async function logOutboundComm(sb: Admin, opts: RunConciergeOpts, body: string): Promise<void> {
  await sb.from('communications').insert({
    lead_id: opts.leadId, org_id: opts.orgId, sender_id: opts.loId,
    channel: 'sms', direction: 'outbound', body, consent_status_at_send: true, sent_at: new Date().toISOString(),
  }).then(() => undefined, () => undefined);
}

async function createApprovalTask(sb: Admin, opts: RunConciergeOpts, first: string): Promise<void> {
  await sb.from('lead_tasks').insert({
    lead_id: opts.leadId, org_id: opts.orgId, assigned_to: opts.loId,
    title: `Approve AI reply to ${first}`, description: 'Ashley Concierge drafted a reply — review and send from the lead page.',
    priority: 'high', completed: false, due_date: new Date().toISOString(),
  }).then(() => undefined, () => undefined);
}

async function escalateTask(sb: Admin, opts: RunConciergeOpts, first: string, reason: string): Promise<void> {
  await sb.from('lead_tasks').insert({
    lead_id: opts.leadId, org_id: opts.orgId, assigned_to: opts.loId,
    title: `Take over chat with ${first}`, description: `Ashley Concierge handed off: ${reason}`,
    priority: 'high', completed: false, due_date: new Date().toISOString(),
  }).then(() => undefined, () => undefined);
}

async function escalateConversation(sb: Admin, convId: string, opts: RunConciergeOpts, reason: string, taskTitle: string): Promise<void> {
  await sb.from('ai_conversations').update({ status: 'escalated', escalation_reason: reason, escalated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', convId).then(() => undefined, () => undefined);
  await sb.from('lead_tasks').insert({ lead_id: opts.leadId, org_id: opts.orgId, assigned_to: opts.loId, title: taskTitle, description: reason, priority: 'high', completed: false, due_date: new Date().toISOString() }).then(() => undefined, () => undefined);
}
