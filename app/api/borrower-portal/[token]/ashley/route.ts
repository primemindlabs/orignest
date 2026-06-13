// Phase 123 — Ask Ashley (borrower-facing AI mortgage guide), token-gated.
// Distinct from the LO "Ashley brain": this is the consumer assistant on the portal.
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePortalToken } from '@/lib/portal/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ASHLEY_SYSTEM = `You are Ashley, an AI mortgage guide for Ashley IQ. You help borrowers understand their loan clearly and confidently.
You answer questions about: why their credit score changed, what conditional approval means, how much cash they need at closing, whether they should refinance, whether they can buy a rental, what DSCR loans are, and general mortgage process questions.
Rules:
- Be warm, clear, and specific to their situation when data is provided.
- Include specific dollar amounts, percentages, and timelines when possible.
- End every response with a concrete next step or action.
- Never provide investment advice or guarantee loan outcomes. Never quote a specific interest rate as available to them.
- Always include this sentence: "This is general guidance. Your Ashley IQ loan officer has your complete picture."
- Keep answers under 150 words unless the question requires more detail.`;

export async function POST(request: Request, { params }: { params: { token: string } }) {
  const sb = createAdminClient();
  const id = await resolvePortalToken(sb, params.token);
  if (!id) return NextResponse.json({ error: 'Invalid portal link' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const message = (body?.message ?? '').toString().trim();
  if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 });
  if (message.length > 1000) return NextResponse.json({ error: 'Message too long' }, { status: 400 });

  // Conversation history (last 12 turns), oldest-first for the model.
  const { data: history } = await sb
    .from('ashley_conversations')
    .select('role, content')
    .eq('lead_id', id.leadId)
    .order('created_at', { ascending: false })
    .limit(12);
  const priorMessages = (history ?? []).reverse().map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content as string }));

  // Light, non-PII loan context for grounding.
  const { data: lead } = await sb.from('leads').select('first_name, stage, loan_type, property_address').eq('id', id.leadId).eq('org_id', id.orgId).maybeSingle();
  const context = lead ? `Borrower first name: ${lead.first_name ?? 'there'}. Loan stage: ${lead.stage}. Loan type: ${lead.loan_type ?? 'n/a'}. Property: ${lead.property_address ?? 'n/a'}.` : '';

  let answer = "I'm having trouble right now — please try again, or message your loan officer directly. This is general guidance. Your Ashley IQ loan officer has your complete picture.";
  let tokensUsed: number | null = null;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const resp = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: context ? `${ASHLEY_SYSTEM}\n\nBorrower context:\n${context}` : ASHLEY_SYSTEM,
        messages: [...priorMessages, { role: 'user', content: message }],
      });
      const block = resp.content.find((c) => c.type === 'text');
      answer = block && block.type === 'text' ? block.text : answer;
      tokensUsed = resp.usage.output_tokens;
    } catch {
      /* fall through to the safe default */
    }
  }

  // INSERT-only: persist both turns.
  await sb.from('ashley_conversations').insert([
    { lead_id: id.leadId, org_id: id.orgId, role: 'user', content: message },
    { lead_id: id.leadId, org_id: id.orgId, role: 'assistant', content: answer, tokens_used: tokensUsed },
  ]);

  return NextResponse.json({ message: answer });
}
