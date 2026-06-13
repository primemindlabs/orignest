// Phase 123 — Financial Concierge (token-gated). Claude Haiku analyzes the borrower's
// picture and suggests next loan products. Educational only — no rate promises.
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolvePortalToken } from '@/lib/portal/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM = `You are Ashley, a financial concierge for a mortgage borrower. Given their picture, suggest up to 3 next-step products or moves (e.g. HELOC, rate/term refinance, cash-out refinance, an investment/DSCR purchase, PMI removal). For each: a short title and 1-2 plain sentences on why it might fit and the tradeoff. Educational only — never promise approval, never quote a specific available rate, never give investment advice. Output JSON only: {"recommendations":[{"title":"","why":"","tradeoff":""}]}`;

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  const sb = createAdminClient();
  const id = await resolvePortalToken(sb, params.token);
  if (!id) return NextResponse.json({ error: 'Invalid portal link' }, { status: 404 });

  const { data: lead } = await sb.from('leads').select('loan_type, ltv, original_rate, estimated_value, loan_amount, credit_score').eq('id', id.leadId).eq('org_id', id.orgId).maybeSingle();
  const { data: props } = await sb.from('borrower_properties').select('id').eq('lead_id', id.leadId);
  const equity = lead?.estimated_value != null && lead?.loan_amount != null ? Number(lead.estimated_value) - Number(lead.loan_amount) : null;

  const fallback = [
    { title: 'Review your equity options', why: 'You may have equity that could fund a renovation, debt consolidation, or an investment down payment.', tradeoff: 'Borrowing against equity increases your balance and monthly obligations.' },
    { title: 'Set a refinance watch', why: 'If market rates move below your current rate, refinancing could lower your payment.', tradeoff: 'Refinancing has closing costs that take time to recoup.' },
  ];

  let recommendations = fallback;
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const ctx = `Loan type: ${lead?.loan_type ?? 'n/a'}. LTV: ${lead?.ltv ?? 'n/a'}. Current rate: ${lead?.original_rate ?? 'n/a'}. Estimated equity: ${equity ?? 'n/a'}. Credit: ${lead?.credit_score ?? 'n/a'}. Properties owned (in portfolio): ${(props ?? []).length}.`;
      const resp = await client.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 600, system: SYSTEM, messages: [{ role: 'user', content: ctx }] });
      const block = resp.content.find((c) => c.type === 'text');
      const raw = block && block.type === 'text' ? block.text : '';
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed.recommendations) && parsed.recommendations.length) recommendations = parsed.recommendations.slice(0, 3);
      }
    } catch { /* keep fallback */ }
  }

  return NextResponse.json({ recommendations });
}
