import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { assembleLOAContext, serializeContextForPrompt } from '@/lib/loa/context';
import { LOA_SYSTEM_PROMPT } from '@/lib/loa/system-prompt';

const MODEL = 'claude-haiku-4-5-20251001'; // Haiku-only for LOA (cost control). Not configurable via request.
const DAILY_LIMIT = 50;
const MAX_QUESTION_LENGTH = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const question: string = (body?.question ?? '').toString().trim().slice(0, MAX_QUESTION_LENGTH);
  if (!question) {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 });
  }

  const sb = createAdminClient();

  // Resolve the caller's profile id (loId) — the uuid that scopes leads/transitions/roi.
  const { data: profile } = await sb
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();
  const loId = profile?.id as string | undefined;
  if (!loId) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  // ── Rate limit: queries in the trailing 24h ─────────────────────────────────
  const windowStart = new Date(Date.now() - DAY_MS).toISOString();
  const { count, error: countError } = await sb
    .from('loa_queries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', loId)
    .gte('created_at', windowStart);

  if (countError) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  const queriesUsed = count ?? 0;
  if (queriesUsed >= DAILY_LIMIT) {
    const resetsAt = new Date(Date.now() + DAY_MS).toISOString();
    return NextResponse.json(
      { error: 'Rate limit exceeded', queries_used: queriesUsed, limit: DAILY_LIMIT, resets_at: resetsAt },
      { status: 429 }
    );
  }

  // ── Assemble aggregate context (no PII) ─────────────────────────────────────
  const context = await assembleLOAContext(sb, orgId, loId);
  const contextText = serializeContextForPrompt(context);

  const userMessage = `BUSINESS CONTEXT:\n${contextText}\n\nQUESTION: ${question}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: LOA_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const block = response.content[0];
  const answer = block && block.type === 'text' ? block.text : '';
  const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;

  // Extract the Source line (heuristic) for structured display + audit.
  const sourceMatch = answer.match(/Source:\s*(.+)$/im);
  const sources = sourceMatch ? sourceMatch[1].split(',').map((s) => s.trim()).filter(Boolean) : [];

  // Which context sections/fields were assembled (audit transparency).
  const contextRecord = context as unknown as Record<string, Record<string, unknown>>;
  const contextFieldsUsed = Object.keys(contextRecord).flatMap((section) =>
    Object.keys(contextRecord[section]).map((field) => `${section}.${field}`)
  );

  // INSERT to the audit log (INSERT-only table). Best-effort: never block the answer.
  await sb.from('loa_queries').insert({
    org_id: orgId,
    user_id: loId,
    question,
    answer,
    sources,
    context_fields_used: contextFieldsUsed,
    model_version: MODEL,
    tokens_used: tokensUsed,
  });

  return NextResponse.json({ answer, sources, tokens_used: tokensUsed });
}
