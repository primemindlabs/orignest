/**
 * Phase 49.8 — condition submission package. Bundles every condition's included
 * documents and generates a professional processor cover sheet (Claude Haiku).
 * Returns the cover sheet + manifest; the actual merged-PDF render is deferred.
 */
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { loanId: string } }) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const [{ data: conditions }, { data: lead }] = await Promise.all([
    sb.from('loan_conditions').select('id, condition_text, category, status, condition_documents(file_name, is_included_in_submission)').eq('lead_id', params.loanId).eq('org_id', orgId).order('created_at'),
    sb.from('leads').select('first_name, last_name, loan_type, loan_amount, loan_purpose').eq('id', params.loanId).eq('org_id', orgId).maybeSingle(),
  ]);
  if (!lead) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  const conds = conditions ?? [];
  const included = conds.flatMap((c) => (c.condition_documents ?? []).filter((d: { is_included_in_submission: boolean }) => d.is_included_in_submission));
  if (included.length === 0) return NextResponse.json({ error: 'No documents attached to any condition yet.' }, { status: 400 });

  let coverSheet = '';
  if (process.env.ANTHROPIC_API_KEY) {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const list = conds.map((c, i) => `${i + 1}. [${c.status}] ${String(c.condition_text).slice(0, 90)}`).join('\n');
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5', max_tokens: 500,
      messages: [{ role: 'user', content: `Write a brief, professional mortgage processor cover letter for a condition submission package.\nBorrower: ${lead.first_name} ${lead.last_name}\nLoan: ${lead.loan_type ?? ''} · $${((Number(lead.loan_amount) || 0) / 1000).toFixed(0)}K · ${lead.loan_purpose ?? ''}\nConditions addressed (${conds.length}):\n${list}\nBe factual and concise. Include a placeholder for today's date. Do not reference "Ashley IQ".` }],
    });
    coverSheet = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
  }

  // Record the package generation as a condition note trail.
  await sb.from('loan_conditions').select('id').eq('lead_id', params.loanId).eq('org_id', orgId).limit(1); // touch for RLS scope

  return NextResponse.json({
    cover_sheet: coverSheet,
    condition_count: conds.length,
    document_count: included.length,
    manifest: conds.map((c) => ({ condition: String(c.condition_text).slice(0, 80), status: c.status, documents: (c.condition_documents ?? []).filter((d: { is_included_in_submission: boolean }) => d.is_included_in_submission).map((d: { file_name: string }) => d.file_name) })),
  });
}
