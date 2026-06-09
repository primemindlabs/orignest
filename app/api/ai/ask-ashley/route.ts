/**
 * Phase 30.10 — Ask Ashley guideline assistant (LO-only, Claude Sonnet).
 * Stateless: the client sends the running message history.
 */
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getOrgContext } from '@/lib/auth/orgContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = 'claude-sonnet-4-5';

const SYSTEM_PROMPT = `You are Ashley, an expert mortgage guideline assistant.
You have deep knowledge of:
- FNMA Selling Guide (Desktop Underwriter guidelines)
- FHLMC Selling Guide (Loan Product Advisor guidelines)
- FHA Single Family Housing Policy Handbook (4000.1)
- VA Lenders Handbook (M26-7)
- USDA Single Family Housing Guaranteed Loan Program

Answer questions accurately and cite the specific guideline reference.
When asked about DTI, LTV, credit score, or program limits: give the specific number.
If a question is scenario-based, walk through the analysis step by step.
Never guess. If you're unsure, say so and recommend consulting the AE.
Always note if a guideline may have been updated after your knowledge cutoff.`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { messages?: ChatMessage[] };
  const messages = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-12);
  if (messages.length === 0) return NextResponse.json({ error: 'No message' }, { status: 400 });

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const block = res.content[0];
    const reply = block && block.type === 'text' ? block.text : '';
    return NextResponse.json({ reply });
  } catch (err) {
    console.error('[ask-ashley] failed', err);
    return NextResponse.json({ error: 'assistant_failed' }, { status: 502 });
  }
}
