/**
 * Phase 42.3 — AI Drafts: generate a loan-file document/message draft from lead
 * data via Claude Haiku. rate_quote + adverse_action are LO-only (blocked for
 * processor/LOA per the role compliance model).
 */
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DRAFTS: Record<string, { label: string; loOnly?: boolean; instruction: string }> = {
  loe: { label: 'Letter of Explanation', instruction: 'Write a concise borrower Letter of Explanation. Leave a [bracketed] placeholder for the specific item being explained.' },
  cover_letter: { label: 'Processor Cover Letter', instruction: 'Write a brief cover letter from the LO to the processor summarizing the file and what is needed next.' },
  uw_response: { label: 'UW Condition Response', instruction: 'Write a professional response to underwriting addressing outstanding conditions. Use [brackets] for specifics.' },
  rate_quote: { label: 'Rate Quote Email', loOnly: true, instruction: 'Write a warm rate-quote email. Use [bracketed placeholders] for rate/APR/payment — never invent numbers.' },
  pre_dial_brief: { label: 'Pre-Call Briefing', instruction: 'Write a 4-line internal pre-call briefing: loan summary, last context, one key fact, a suggested opener.' },
  gift_letter: { label: 'Gift Letter', instruction: 'Draft a standard mortgage gift letter with [bracketed] placeholders for donor, amount, and relationship.' },
  adverse_action: { label: 'Adverse Action Notice', loOnly: true, instruction: 'Draft an ECOA-compliant adverse action notice shell with [bracketed] placeholders for the specific reasons. Keep it compliant and neutral.' },
  portal_welcome: { label: 'Portal Welcome Message', instruction: 'Write a short, warm welcome message inviting the borrower to their secure portal.' },
};

const LO_ROLES = ['loan_officer', 'admin', 'branch_manager'];

export async function POST(req: Request) {
  const { userId, orgId, role } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const { lead_id, draft_type } = (await req.json().catch(() => ({}))) as { lead_id?: string; draft_type?: string };
  const spec = DRAFTS[draft_type ?? ''];
  if (!spec) return NextResponse.json({ error: 'Invalid draft_type' }, { status: 400 });
  if (spec.loOnly && !LO_ROLES.includes(role)) {
    return NextResponse.json({ error: 'This draft requires your loan officer’s authorization.', code: 'LO_ONLY' }, { status: 403 });
  }
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'AI is not configured.' }, { status: 501 });

  const sb = createAdminClient();
  const { data: lead } = await sb.from('leads').select('first_name, last_name, loan_amount, loan_purpose, loan_type, stage').eq('id', lead_id ?? '').eq('org_id', orgId).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const ctx = `Borrower: ${lead.first_name} ${lead.last_name}\nLoan: $${lead.loan_amount ?? '[amount]'} ${lead.loan_purpose ?? ''} ${lead.loan_type ?? ''}\nStage: ${lead.stage}`;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 900,
    system: 'You are a mortgage loan officer’s writing assistant. Produce professional, compliant, ready-to-send drafts. Never invent financial figures (rate, APR, income, credit score) — use [bracketed placeholders] for any specific number. Never reference "Ashley IQ" or "PrimeMind".',
    messages: [{ role: 'user', content: `Draft type: ${spec.label}.\n${spec.instruction}\n\nLoan context:\n${ctx}` }],
  });
  const content = message.content[0];
  const draft = content.type === 'text' ? content.text : '';
  return NextResponse.json({ draft, label: spec.label });
}
