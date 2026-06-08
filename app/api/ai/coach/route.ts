import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const RATE_LIMIT_PER_HOUR = 20;

interface CoachRequest {
  prompt: string;
  leadContext?: {
    stage?: string;
    loanType?: string;
    creditScore?: number;
    loanAmount?: number;
    daysSinceLastContact?: number;
    tridStatus?: string;
  };
}

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as CoachRequest;
    const { prompt, leadContext } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (prompt.length > 2000) {
      return NextResponse.json({ error: 'Prompt too long (max 2000 characters)' }, { status: 400 });
    }

    // ── Rate limiting ──────────────────────────────────────────────────────
    const sb = createAdminClient();
    const windowStart = new Date();
    windowStart.setMinutes(0, 0, 0);

    const { data: rateLimit } = await sb
      .from('rate_limits')
      .select('count')
      .eq('user_id', userId)
      .eq('action', 'ai_coach')
      .eq('window_start', windowStart.toISOString())
      .maybeSingle();

    const currentCount = rateLimit?.count ?? 0;
    if (currentCount >= RATE_LIMIT_PER_HOUR) {
      return NextResponse.json(
        {
          error: `Rate limit exceeded. AI Coach is limited to ${RATE_LIMIT_PER_HOUR} requests per hour.`,
          code: 'RATE_LIMIT_EXCEEDED',
        },
        { status: 429 }
      );
    }

    // Upsert rate limit counter
    await sb
      .from('rate_limits')
      .upsert(
        {
          user_id: userId,
          action: 'ai_coach',
          window_start: windowStart.toISOString(),
          count: currentCount + 1,
        },
        { onConflict: 'user_id,action,window_start' }
      );

    // ── Build context for Claude ───────────────────────────────────────────
    const contextLines: string[] = [];
    if (leadContext) {
      if (leadContext.stage) contextLines.push(`Loan stage: ${leadContext.stage}`);
      if (leadContext.loanType) contextLines.push(`Loan type: ${leadContext.loanType}`);
      if (leadContext.loanAmount)
        contextLines.push(`Loan amount: $${leadContext.loanAmount.toLocaleString()}`);
      if (leadContext.daysSinceLastContact !== undefined)
        contextLines.push(`Days since last contact: ${leadContext.daysSinceLastContact}`);
      if (leadContext.tridStatus) contextLines.push(`TRID status: ${leadContext.tridStatus}`);
    }

    const systemPrompt = `You are AshleyIQ Coach, an expert mortgage loan officer assistant. You help loan officers:
- Craft persuasive, compliant follow-up messages (TCPA/RESPA aware)
- Strategize to move leads through the pipeline
- Understand TRID compliance requirements
- Identify and resolve pipeline bottlenecks
- Draft professional emails and SMS that are warm, helpful, and RESPA compliant

Always be concise, actionable, and compliant. Never suggest anything that violates TCPA, TRID, ECOA, RESPA, or fair lending laws. If a user asks something legally questionable, redirect them to the compliant approach.

${contextLines.length > 0 ? `Current lead context:\n${contextLines.join('\n')}` : ''}`;

    // ── Call Claude Haiku (fast, in-product AI) ────────────────────────────
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    const responseText = content.type === 'text' ? content.text : '';

    return NextResponse.json({
      response: responseText,
      usage: {
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
      },
    });
  } catch (err) {
    console.error('[ai/coach] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI service error' },
      { status: 500 }
    );
  }
}
