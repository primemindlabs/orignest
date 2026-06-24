/**
 * Phase 145 — Speed-to-Lead first touch. SERVER-ONLY.
 *
 * Composes and (depending on mode) sends Ashley's FIRST text to a brand-new lead,
 * opening a Concierge conversation. Reuses the inbound engine's persona, compliance
 * guard, TCPA gate, and sender — the only difference is there's no borrower message
 * yet, so we prompt the model to write the opener.
 *
 * Idempotent: the ai_conversations unique(org_id, lead_id) plus an up-front existence
 * check mean a lead only ever gets one auto-opener, even if the cron overlaps.
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { canSendSMS } from '@/lib/communications/canSendSMS';
import { getEntityMemories } from '@/lib/brain/getEntityMemories';
import { buildSystemPrompt } from '@/lib/concierge/persona';
import { checkConciergeReply } from '@/lib/concierge/complianceGuard';
import { sendConciergeSms } from '@/lib/concierge/send';
import { enrichPersona } from '@/lib/concierge/enrichPersona';
import { DEFAULT_SETTINGS, type ConciergeContext, type ConciergeSettings, type AutonomyMode } from '@/lib/concierge/types';

type Admin = SupabaseClient<any, any, any>;
const MODEL = 'claude-sonnet-4-6';
const COLS = 'enabled, autonomy_default, allow_autonomous, speed_to_lead, persona_tone, persona_specialties, products, business_goal, booking_url, application_url, max_ai_replies, custom_instructions';

export interface FirstTouchResult {
  ok: boolean;
  reason?: string;
  mode?: AutonomyMode;
  sent?: boolean;
}

export async function initiateConciergeFirstTouch(
  sb: Admin,
  opts: { orgId: string; leadId: string; loId: string | null },
): Promise<FirstTouchResult> {
  // Settings — require enabled + speed_to_lead (lo-specific, else org default row).
  const settings = await loadSettings(sb, opts.orgId, opts.loId);
  if (!settings.enabled || !settings.speed_to_lead) return { ok: false, reason: 'speed-to-lead off' };
  if (settings.autonomy_default === 'off') return { ok: false, reason: 'default mode off' };

  // Don't open a second conversation.
  const { data: existing } = await sb.from('ai_conversations').select('id').eq('org_id', opts.orgId).eq('lead_id', opts.leadId).maybeSingle();
  if (existing) return { ok: false, reason: 'conversation already exists' };

  // TCPA gate up front — no consent/phone/window → no opener.
  const gate = await canSendSMS(sb, { orgId: opts.orgId, leadId: opts.leadId, category: 'loan_updates' });
  const willSend = settings.autonomy_default === 'autonomous' && settings.allow_autonomous;
  if (willSend && !gate.allowed) return { ok: false, reason: gate.reason ?? 'TCPA not permitted' };

  const ctx = await buildContext(sb, opts, settings);

  // Compose the opener.
  let text = await composeOpener(ctx);
  let gated = false;
  const guard = checkConciergeReply(text);
  if (!guard.ok || !text.trim()) {
    gated = !guard.ok;
    text = `Hi ${ctx.borrowerFirstName}! This is ${ctx.loName}'s team — thanks for reaching out about your mortgage. To point you in the right direction, are you looking to buy or refinance?`;
  }

  // Open the conversation in the LO's default mode.
  const mode = settings.autonomy_default;
  const { data: conv } = await sb.from('ai_conversations').insert({
    org_id: opts.orgId, lead_id: opts.leadId, lo_id: opts.loId, channel: 'sms',
    autonomy_mode: mode, status: 'active',
  }).select('id').single();
  if (!conv) return { ok: false, reason: 'could not open conversation' };

  let sent = false;
  if (mode === 'autonomous' && settings.allow_autonomous && gate.allowed) {
    const res = await sendConciergeSms(sb, { orgId: opts.orgId, leadId: opts.leadId, loId: opts.loId, body: text });
    sent = res.ok;
    if (sent) {
      await sb.from('communications').insert({ lead_id: opts.leadId, org_id: opts.orgId, sender_id: opts.loId, channel: 'sms', direction: 'outbound', body: text, consent_status_at_send: true, sent_at: new Date().toISOString() }).then(() => undefined, () => undefined);
    }
  } else {
    // suggest mode → draft for the LO to approve.
    await sb.from('lead_tasks').insert({
      lead_id: opts.leadId, org_id: opts.orgId, assigned_to: opts.loId,
      title: `Approve Ashley's intro to ${ctx.borrowerFirstName}`, description: 'Speed-to-lead drafted an opening text — review and send from the lead page.',
      priority: 'high', completed: false, due_date: new Date().toISOString(),
    }).then(() => undefined, () => undefined);
  }

  await sb.from('ai_conversation_messages').insert({
    conversation_id: conv.id, org_id: opts.orgId, lead_id: opts.leadId, role: 'assistant',
    body: text, gated, gate_reason: gated ? guard.reason : null, sent, sent_at: sent ? new Date().toISOString() : null,
  }).then(() => undefined, () => undefined);

  await sb.from('ai_conversations').update({ message_count: 1, last_ai_reply_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', conv.id).then(() => undefined, () => undefined);

  return { ok: true, mode, sent };
}

async function composeOpener(ctx: ConciergeContext): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return '';
  try {
    const anthropic = new Anthropic({ apiKey });
    const resp = await anthropic.messages.create({
      model: MODEL, max_tokens: 300, system: buildSystemPrompt(ctx),
      messages: [{ role: 'user', content: `[A brand-new lead just came in — ${ctx.borrowerFirstName} hasn't texted yet. Write your very FIRST outreach text to them: introduce yourself warmly as ${ctx.loName}'s assistant, reference that they reached out about a mortgage, and ask one simple question to get the conversation started. Keep it short and natural. Output only the text message.]` }],
    });
    return resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join(' ').trim();
  } catch (e) {
    console.error('[concierge] opener generation failed', e);
    return '';
  }
}

async function loadSettings(sb: Admin, orgId: string, loId: string | null): Promise<ConciergeSettings> {
  let row: Record<string, any> | null = null;
  if (loId) {
    const { data } = await sb.from('ai_concierge_settings').select(COLS).eq('org_id', orgId).eq('lo_id', loId).maybeSingle();
    row = data ?? null;
  }
  if (!row) {
    const { data } = await sb.from('ai_concierge_settings').select(COLS).eq('org_id', orgId).is('lo_id', null).maybeSingle();
    row = data ?? null;
  }
  const merged = { ...DEFAULT_SETTINGS, ...(row ?? {}) } as ConciergeSettings;
  return enrichPersona(sb, orgId, loId, merged);
}

async function buildContext(sb: Admin, opts: { orgId: string; leadId: string; loId: string | null }, settings: ConciergeSettings): Promise<ConciergeContext> {
  const [{ data: lead }, { data: org }, lo] = await Promise.all([
    sb.from('leads').select('first_name, loan_purpose, loan_amount, timeline, property_state, loan_type, lead_source').eq('id', opts.leadId).eq('org_id', opts.orgId).maybeSingle(),
    sb.from('organizations').select('name').eq('id', opts.orgId).maybeSingle(),
    opts.loId ? sb.from('profiles').select('first_name, last_name').eq('id', opts.loId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const loRow = ((lo as { data?: { first_name?: string; last_name?: string } }).data ?? {}) as { first_name?: string; last_name?: string };
  const leadRow = (lead ?? {}) as Record<string, any>;

  let memories: string[] = [];
  if (opts.loId) {
    try {
      const mem = await getEntityMemories(sb as any, opts.loId, 'lead' as any, opts.leadId, { limit: 6 });
      memories = mem.map((m: any) => m.memory_text).filter(Boolean);
    } catch { /* Brain optional */ }
  }
  const knownFacts: Record<string, unknown> = {};
  for (const k of ['loan_purpose', 'loan_amount', 'timeline', 'property_state', 'loan_type', 'lead_source']) {
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
