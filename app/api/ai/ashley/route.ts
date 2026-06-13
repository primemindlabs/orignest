/**
 * Ashley brain — single unified endpoint behind the one Ashley chat. Auto-routes each
 * message to the right engine so it feels like one assistant:
 *   • Business-intelligence questions about the user's book ("how many funded?",
 *     "what's my conversion?") → the LOA aggregate-context engine (no-PII, sourced,
 *     50/day) — same logic as /api/loa/query.
 *   • Everything else (drafting, strategy, compliance, how-to) → the coaching engine
 *     (Haiku, 20/hr) — same logic as /api/ai/coach.
 * The legacy /api/loa/query and /api/ai/coach routes stay for their existing callers.
 */
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { assembleLOAContext, serializeContextForPrompt } from '@/lib/loa/context';
import { LOA_SYSTEM_PROMPT } from '@/lib/loa/system-prompt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = 'claude-haiku-4-5';
const BI_DAILY_LIMIT = 50;
const COACH_HOURLY_LIMIT = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

// Heuristic intent router. Biases toward BI only when the message clearly asks about
// the user's own numbers/pipeline; otherwise coaching (drafting/strategy/how-to).
const BI_PATTERNS = [
  /\bhow many\b/i, /\bhow much\b/i, /\bwhat'?s my\b/i, /\bwhat is my\b/i,
  /\b(pipeline|funded|closings?|volume|conversion|pull[- ]?through|fallout|stalled|at[- ]risk)\b/i,
  /\b(this|last) (month|week|quarter|year)\b/i, /\b(ytd|mtd|year to date)\b/i,
  /\b(average|avg|median|total|count|number of|rate of|trend|leaderboard|roi)\b/i,
  /\b(referr(al|ed)|sources?)\b.*\b(best|top|most|count|how many)\b/i,
  /\bdays? to close\b/i, /\bmy (book|numbers|stats|metrics|performance)\b/i,
];
function classifyIntent(message: string): 'bi' | 'coach' {
  return BI_PATTERNS.some((re) => re.test(message)) ? 'bi' : 'coach';
}

const text = (m: Anthropic.Message): string => {
  const b = m.content.find((c) => c.type === 'text');
  return b && b.type === 'text' ? b.text : '';
};

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const message: string = (body?.message ?? body?.prompt ?? '').toString().trim();
  if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  if (message.length > 2000) return NextResponse.json({ error: 'Message too long' }, { status: 400 });

  const sb = createAdminClient();
  const { data: profile } = await sb.from('profiles').select('id').eq('clerk_user_id', userId).maybeSingle();
  const loId = profile?.id as string | undefined;
  if (!loId) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const intent = body?.forceMode === 'bi' || body?.forceMode === 'coach' ? body.forceMode : classifyIntent(message);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // ── Business intelligence branch (aggregate, no-PII, sourced) ───────────────
  if (intent === 'bi') {
    const windowStart = new Date(Date.now() - DAY_MS).toISOString();
    const { count } = await sb.from('loa_queries').select('id', { count: 'exact', head: true }).eq('user_id', loId).gte('created_at', windowStart);
    const used = count ?? 0;
    if (used >= BI_DAILY_LIMIT) {
      return NextResponse.json({ mode: 'bi', error: 'rate_limit', answer: `You've reached your daily limit of ${BI_DAILY_LIMIT} insight questions. It resets in ~24 hours — I can still help with drafting, strategy, or anything else in the meantime.` }, { status: 200 });
    }

    const context = await assembleLOAContext(sb, orgId, loId);
    const contextText = serializeContextForPrompt(context);
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: LOA_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `BUSINESS CONTEXT:\n${contextText}\n\nQUESTION: ${message.slice(0, 500)}` }],
    });
    const answer = text(response);
    const sourceMatch = answer.match(/Source:\s*(.+)$/im);
    const sources = sourceMatch ? sourceMatch[1].split(',').map((s) => s.trim()).filter(Boolean) : [];

    const contextRecord = context as unknown as Record<string, Record<string, unknown>>;
    const contextFieldsUsed = Object.keys(contextRecord).flatMap((section) => Object.keys(contextRecord[section]).map((field) => `${section}.${field}`));
    await sb.from('loa_queries').insert({
      org_id: orgId, user_id: loId, question: message.slice(0, 500), answer, sources,
      context_fields_used: contextFieldsUsed, model_version: 'claude-haiku-4-5-20251001',
      tokens_used: response.usage.input_tokens + response.usage.output_tokens,
    });

    return NextResponse.json({ mode: 'bi', answer, sources });
  }

  // ── Coaching branch (drafting / strategy / compliance / how-to) ─────────────
  const hourStart = new Date();
  hourStart.setMinutes(0, 0, 0);
  const { data: rl } = await sb.from('rate_limits').select('count').eq('user_id', userId).eq('action', 'ai_coach').eq('window_start', hourStart.toISOString()).maybeSingle();
  const cur = rl?.count ?? 0;
  if (cur >= COACH_HOURLY_LIMIT) {
    return NextResponse.json({ mode: 'coach', error: 'rate_limit', answer: `I've hit my hourly coaching limit (${COACH_HOURLY_LIMIT}/hr). Give me a few minutes and ask again.` }, { status: 200 });
  }
  await sb.from('rate_limits').upsert({ user_id: userId, action: 'ai_coach', window_start: hourStart.toISOString(), count: cur + 1 }, { onConflict: 'user_id,action,window_start' });

  const systemPrompt = `You are Ashley, an expert mortgage loan officer assistant. You help loan officers:
- Craft persuasive, compliant follow-up messages (TCPA/RESPA aware)
- Strategize to move leads through the pipeline
- Understand TRID compliance requirements
- Identify and resolve pipeline bottlenecks
- Draft professional emails and SMS that are warm, helpful, and RESPA compliant
Always be concise, actionable, and compliant. Never suggest anything that violates TCPA, TRID, ECOA, RESPA, or fair lending laws. If a user asks something legally questionable, redirect them to the compliant approach. If they ask for a specific number about their own pipeline you don't have, suggest they ask it as a data question.`;

  const message_ = await anthropic.messages.create({ model: MODEL, max_tokens: 1024, system: systemPrompt, messages: [{ role: 'user', content: message }] });
  return NextResponse.json({ mode: 'coach', answer: text(message_) });
}
