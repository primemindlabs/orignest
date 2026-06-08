import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const STAGE_CONTEXT: Record<string, string> = {
  new_inquiry: 'They submitted an inquiry but we never connected.',
  pre_qualified: 'They completed a pre-qualification but went quiet before applying.',
  application_started: 'They started a loan application but did not finish it.',
  application_complete: 'They finished their application but communication stopped.',
  processing: 'Their loan was in processing but communication stopped.',
  underwriting: 'Their loan was in underwriting but communication stopped.',
};

interface SequenceItem {
  day: number;
  channel: 'sms' | 'email';
  subject?: string;
  message: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { queue_id } = (await req.json()) as { queue_id: string };
  if (!queue_id) return NextResponse.json({ error: 'queue_id required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: org } = await sb.from('organizations').select('id').eq('clerk_org_id', orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const { data: item } = await sb
    .from('ghost_recovery_queue')
    .select('*, leads(first_name, last_name, loan_purpose)')
    .eq('id', queue_id)
    .eq('org_id', org.id)
    .maybeSingle();

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const lead = item.leads as { first_name: string; loan_purpose: string | null } | null;
  const context = STAGE_CONTEXT[item.stage_when_ghosted as string] || 'They went quiet.';

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `Generate a 3-touch re-engagement sequence for a ghosted mortgage lead. Warm, helpful, non-pressuring. Each message should feel different.

Borrower first name: ${lead?.first_name ?? 'there'}
Drop-off context: ${context}
Days inactive: ${item.days_inactive}
Loan purpose: ${lead?.loan_purpose ?? 'home purchase'}

Return ONLY valid JSON, no markdown, no explanation:
{
  "sequence": [
    {"day": 1, "channel": "sms", "message": "..."},
    {"day": 3, "channel": "email", "subject": "...", "message": "..."},
    {"day": 7, "channel": "sms", "message": "..."}
  ]
}`,
    }],
  });

  const block = response.content[0];
  const text = block.type === 'text' ? block.text : '';

  let parsed: { sequence: SequenceItem[] };
  try {
    parsed = JSON.parse(text) as { sequence: SequenceItem[] };
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
  }

  await sb
    .from('ghost_recovery_queue')
    .update({ ai_sequence: parsed.sequence })
    .eq('id', queue_id)
    .eq('org_id', org.id);

  return NextResponse.json({ sequence: parsed.sequence });
}
