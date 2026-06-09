/**
 * Phase 33.7 — post-call AI summary (Claude Haiku). Writes a call_transcriptions
 * row and appends a CRM activity to the lead timeline. No financial specifics.
 */
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = 'claude-haiku-4-5';

export async function POST(req: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { call_id?: string; lead_id?: string; disposition?: string; transcript_text?: string; notes?: string };
  if (!body.lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });

  const source = (body.transcript_text || body.notes || '').slice(0, 3000);
  let summaryText = '';
  if (source.trim()) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Summarize this mortgage sales call in 2-3 sentences for a CRM activity log. Include: what was discussed, any objections raised, and the agreed next step (if any).
Disposition: ${body.disposition ?? 'n/a'}
Notes/transcript: ${source}
Write in past tense, third person ("Borrower expressed..."). No financial specifics (rates, income, credit scores).`,
        }],
      });
      const block = res.content[0];
      summaryText = block && block.type === 'text' ? block.text.trim() : '';
    } catch (err) {
      console.error('[post-call-summary] failed', err);
    }
  }
  if (!summaryText) summaryText = `Call logged${body.disposition ? ` — ${body.disposition.replace(/_/g, ' ')}` : ''}.`;

  const sb = createAdminClient();
  if (body.call_id) {
    await sb.from('call_transcriptions').insert({ call_id: body.call_id, org_id: orgId, transcript_text: body.transcript_text ?? null, ai_summary: summaryText }).then(() => undefined, () => undefined);
  }
  await sb.from('lead_activities').insert({
    lead_id: body.lead_id,
    org_id: orgId,
    action: 'dialer_call_summary',
    description: summaryText,
    metadata: { call_id: body.call_id ?? null, disposition: body.disposition ?? null },
  }).then(() => undefined, () => undefined);

  return NextResponse.json({ summary: summaryText });
}
