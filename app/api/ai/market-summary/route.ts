import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const RATE_LIMIT_PER_MINUTE = 10;

const requestSchema = z.object({
  currentRates: z.object({
    thirtyYrFixed: z.number(),
    fifteenYrFixed: z.number(),
    fiveOneArm: z.number(),
    fha: z.number(),
    va: z.number(),
  }),
  pipelineStats: z.object({
    activeLeads: z.number(),
    pipelineValue: z.number(),
  }),
  closedVolumeMTD: z.number(),
});

const SYSTEM_PROMPT = `You are a mortgage market intelligence analyst embedded in AshleyIQ, a CRM for loan officers and mortgage brokers.

Given current market rate data and pipeline metrics, generate a concise, actionable 3-sentence market intelligence summary for a loan officer's morning briefing.

Rules:
- Be specific: reference the actual rate numbers provided
- Be actionable: recommend a specific action (call past clients, target investor leads, etc.)
- Be realistic: don't hype up opportunities, give honest market read
- Never fabricate data beyond what's provided
- Do not use markdown formatting — plain sentences only
- Keep it to exactly 3 sentences`;

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 422 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
  }

  // Rate limit — 10 requests/min per user
  const admin = createAdminClient();
  const windowStart = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from('rate_limit_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('endpoint', '/api/ai/market-summary')
    .gte('created_at', windowStart);

  if ((count ?? 0) >= RATE_LIMIT_PER_MINUTE) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again in a minute.' }, { status: 429 });
  }

  await admin.from('rate_limit_log').insert({
    user_id: userId,
    endpoint: '/api/ai/market-summary',
    ip_address: req.headers.get('x-forwarded-for') ?? null,
    created_at: new Date().toISOString(),
  });

  const { currentRates, pipelineStats, closedVolumeMTD } = parsed.data;

  const prompt = `Current mortgage rates:
- 30-year fixed: ${currentRates.thirtyYrFixed}%
- 15-year fixed: ${currentRates.fifteenYrFixed}%
- 5/1 ARM: ${currentRates.fiveOneArm}%
- FHA 30-year: ${currentRates.fha}%
- VA 30-year: ${currentRates.va}%

Pipeline data:
- Active leads: ${pipelineStats.activeLeads}
- Total pipeline value: $${(pipelineStats.pipelineValue / 1_000_000).toFixed(2)}M
- Closed volume MTD: $${(closedVolumeMTD / 1_000_000).toFixed(2)}M

Generate a 3-sentence market intelligence briefing for this loan officer.`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    const content = textContent?.type === 'text' ? textContent.text : 'Unable to generate summary.';

    return NextResponse.json({ content });
  } catch (err) {
    console.error('[ai/market-summary]', err);
    return NextResponse.json({ error: 'AI request failed' }, { status: 500 });
  }
}
