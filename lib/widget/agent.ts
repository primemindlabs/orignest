/**
 * Phase 146 — website chat agent. SERVER-ONLY.
 *
 * Claude Sonnet 4.6 manual tool loop for the anonymous website visitor: answers
 * general mortgage questions, naturally collects name/email/phone + SMS consent, and
 * calls capture_contact to create the lead. Same compliance guard as the Concierge
 * (no quoted rates/$/APR/approval). Persona/tone pulled from the LO's concierge
 * settings so the website voice matches the texting voice.
 */
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkConciergeReply } from '@/lib/concierge/complianceGuard';
import { captureLeadFromSession } from '@/lib/widget/capture';

type Admin = SupabaseClient<any, any, any>;
const MODEL = 'claude-sonnet-4-6';
const MAX_LOOPS = 4;

export interface WebWidget { id: string; org_id: string; lo_id: string | null }
export interface WebSession { id: string; captured: boolean }

export interface WebAgentResult { reply: string; captured: boolean }

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'capture_contact',
    description: "Save the visitor's contact info as soon as you have their name AND (email or phone). Set sms_consent true ONLY if they clearly agree to be texted.",
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        sms_consent: { type: 'boolean', description: 'true only if the visitor explicitly agreed to receive texts' },
      },
      required: [],
    },
  },
];

export async function runWebAgent(
  sb: Admin,
  args: { widget: WebWidget; session: WebSession; history: Anthropic.MessageParam[]; inboundText: string },
): Promise<WebAgentResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { reply: "Thanks for reaching out! Please leave your name and email and a loan officer will get right back to you.", captured: false };

  const system = await buildWebSystem(sb, args.widget);
  const anthropic = new Anthropic({ apiKey });
  const msgs: Anthropic.MessageParam[] = [...args.history, { role: 'user', content: args.inboundText }];
  // First turn must be a user message.
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();

  let reply = '';
  let captured = args.session.captured;

  for (let i = 0; i < MAX_LOOPS; i++) {
    let resp: Anthropic.Message;
    try {
      resp = await anthropic.messages.create({ model: MODEL, max_tokens: 700, system, tools: TOOLS, messages: msgs });
    } catch (e) {
      console.error('[widget] model error', e);
      break;
    }
    const textNow = resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join(' ').trim();
    if (textNow) reply = textNow;
    const toolUses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');

    if (resp.stop_reason === 'tool_use' && toolUses.length) {
      msgs.push({ role: 'assistant', content: resp.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        const input = (tu.input ?? {}) as Record<string, unknown>;
        if (tu.name === 'capture_contact') {
          await captureLeadFromSession(sb, {
            orgId: args.widget.org_id, loId: args.widget.lo_id, sessionId: args.session.id,
            name: input.name as string | undefined, email: input.email as string | undefined,
            phone: input.phone as string | undefined, smsConsent: input.sms_consent === true,
          });
          captured = true;
          results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify({ saved: true }) });
        } else {
          results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify({ error: 'unknown tool' }) });
        }
      }
      msgs.push({ role: 'user', content: results });
      continue;
    }
    break; // end_turn
  }

  if (!reply) reply = "Thanks! A loan officer will follow up with you shortly.";
  if (!checkConciergeReply(reply).ok) {
    reply = "Great question — the exact numbers depend on your situation, so I'll have a loan officer go over the specifics with you. What's the best email or phone to reach you?";
  }
  return { reply, captured };
}

async function buildWebSystem(sb: Admin, widget: WebWidget): Promise<string> {
  const [{ data: settings }, { data: org }, lo] = await Promise.all([
    widget.lo_id
      ? sb.from('ai_concierge_settings').select('persona_tone, persona_specialties, products').eq('org_id', widget.org_id).eq('lo_id', widget.lo_id).maybeSingle()
      : Promise.resolve({ data: null }),
    sb.from('organizations').select('name').eq('id', widget.org_id).maybeSingle(),
    widget.lo_id ? sb.from('profiles').select('first_name, last_name').eq('id', widget.lo_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const s = (settings ?? {}) as { persona_tone?: string; persona_specialties?: string; products?: string };
  const loRow = ((lo as { data?: { first_name?: string; last_name?: string } }).data ?? {}) as { first_name?: string; last_name?: string };
  const loName = `${loRow.first_name ?? ''} ${loRow.last_name ?? ''}`.trim() || 'our loan team';
  const company = ((org ?? {}) as { name?: string }).name || 'our team';
  const tone = s.persona_tone || 'warm, concise, and professional';
  const specialties = s.persona_specialties ? ` They specialize in ${s.persona_specialties}.` : '';
  const products = s.products ? ` Products you can mention generally (no pricing): ${s.products}.` : '';

  return `You are the website chat assistant for ${loName} at ${company}.${specialties} A visitor on the website is chatting with you. Your tone is ${tone}.${products}

Your job: be genuinely helpful with GENERAL mortgage questions (how the process works, document checklists, loan-type basics, timelines), and naturally collect the visitor's name, email, phone number, and permission to text them so ${loName} can follow up. Don't interrogate — answer their question first, then ask for contact info once they show interest. As soon as you have a name AND (an email or phone), call capture_contact (set sms_consent true only if they clearly agreed to be texted).

Keep replies short — 2 to 4 sentences. Do NOT identify yourself as an AI or mention any software platform.

HARD RULES (compliance): never quote or imply a specific interest rate, APR, fee, monthly payment, closing cost, or any dollar figure, and never say anyone is approved, pre-approved, qualified, or guaranteed anything — tell them ${loName} will go over exact numbers. No legal or tax advice.`;
}
