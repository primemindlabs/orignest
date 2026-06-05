import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AIUserAction } from '@/types';

export const runtime = 'nodejs';

interface InteractionPayload {
  agentType: string;
  leadId?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  userAction?: AIUserAction;
}

/**
 * POST /api/ai/interactions
 * Records an AI interaction event (agent call metrics + user action).
 * Called after every AI response to power the learning loop.
 */
export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as InteractionPayload | null;
  if (!body?.agentType) {
    return NextResponse.json({ error: 'agentType is required' }, { status: 400 });
  }

  const sb = createAdminClient();

  const { error } = await sb.from('ai_interactions').insert({
    org_id: orgId ?? null,
    user_id: userId,
    lead_id: body.leadId ?? null,
    agent_type: body.agentType,
    input_tokens: body.inputTokens ?? null,
    output_tokens: body.outputTokens ?? null,
    latency_ms: body.latencyMs ?? null,
    user_action: body.userAction ?? null,
  });

  if (error) {
    console.error('[ai/interactions]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
