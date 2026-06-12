// Phase 82 — POST a natural-language question about ONE loan file.
// Answers strictly from assembled loan context (Haiku 4.5), logs every Q&A to the
// INSERT-only loan_ai_queries audit table, returns { answer, sources }.

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildLoanContext } from '@/lib/loan-ai/buildLoanContext';
import { buildSystemPrompt, extractSources } from '@/lib/loan-ai/prompt';

export const runtime = 'nodejs';

const RATE_LIMIT_PER_HOUR = 40;

export async function POST(req: Request, { params }: { params: { loanId: string } }) {
  try {
    const { userId, orgId } = await getOrgContext();
    if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { question } = (await req.json().catch(() => ({}))) as { question?: string };
    const q = question?.trim();
    if (!q) return NextResponse.json({ error: 'question required' }, { status: 400 });
    if (q.length > 500) return NextResponse.json({ error: 'question too long' }, { status: 400 });

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI is not configured' }, { status: 503 });
    }

    const sb = createAdminClient();

    const { data: profile } = await sb
      .from('profiles')
      .select('id')
      .eq('clerk_user_id', userId)
      .maybeSingle();
    const profileId = profile?.id as string | undefined;
    if (!profileId) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    // Simple per-user hourly rate limit (cost guard).
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await sb
      .from('loan_ai_queries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profileId)
      .gte('created_at', hourAgo);
    if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return NextResponse.json({ error: 'Rate limit reached. Try again later.' }, { status: 429 });
    }

    const context = await buildLoanContext(sb, orgId, params.loanId);
    if (!context) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      system: buildSystemPrompt(context),
      messages: [{ role: 'user', content: q }],
    });

    const block = message.content[0];
    const answer = block?.type === 'text' ? block.text.trim() : '';
    const sources = extractSources(answer);

    await sb.from('loan_ai_queries').insert({
      org_id: orgId,
      user_id: profileId,
      lead_id: params.loanId,
      question: q,
      answer,
      sources,
      context_fields_used: Object.keys(context),
      model_version: 'claude-haiku-4-5',
      tokens_used: (message.usage?.input_tokens ?? 0) + (message.usage?.output_tokens ?? 0),
    });

    return NextResponse.json({ answer, sources });
  } catch (err) {
    console.error('[loans ai-query]', err);
    return NextResponse.json({ error: 'AI service error' }, { status: 500 });
  }
}
