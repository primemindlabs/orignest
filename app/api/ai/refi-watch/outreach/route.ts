import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { opportunity_id } = (await req.json()) as { opportunity_id: string };
  if (!opportunity_id) return NextResponse.json({ error: 'opportunity_id required' }, { status: 400 });

  const sb = createAdminClient();
  const { data: org } = await sb.from('organizations').select('id').eq('clerk_org_id', orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const { data: opp } = await sb
    .from('refi_opportunities')
    .select('*, leads(first_name, last_name, closed_date, original_loan_program)')
    .eq('id', opportunity_id)
    .eq('org_id', org.id)
    .maybeSingle();

  if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const lead = opp.leads as { first_name: string; closed_date: string | null } | null;
  const closedDateStr = lead?.closed_date
    ? new Date(lead.closed_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'previously';

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Write a warm, personal text message from a mortgage loan officer to a past client about a refinance opportunity. Under 160 characters. Conversational. Mention the specific monthly savings. No emojis needed.

Client first name: ${lead?.first_name ?? 'there'}
Original rate: ${opp.original_rate}%
Current rate available: ${opp.current_market_rate}%
Monthly savings: $${opp.monthly_savings}
When they closed: ${closedDateStr}

Write ONLY the text message. No quotes, no label, no explanation.`,
    }],
  });

  const block = response.content[0];
  const draft = block.type === 'text' ? block.text.trim() : '';

  await sb
    .from('refi_opportunities')
    .update({ ai_message_draft: draft })
    .eq('id', opportunity_id)
    .eq('org_id', org.id);

  return NextResponse.json({ draft });
}
