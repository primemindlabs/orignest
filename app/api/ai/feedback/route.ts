import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

type AIType =
  | 'lead_score'
  | 'sms_draft'
  | 'email_draft'
  | 'morning_briefing'
  | 'deal_analysis'
  | 'conditions_parse';

type UserAction = 'accepted' | 'edited' | 'rejected' | 'no_action';

interface FeedbackPayload {
  aiType: AIType;
  inputContext: Record<string, unknown>;
  aiOutput: string;
  userAction: UserAction;
  editedOutput?: string;
  outcomeMetric?: string;
}

export async function POST(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null) as FeedbackPayload | null;
  if (!body || !body.aiType || !body.aiOutput || !body.userAction) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const sb = createAdminClient();

  const { error } = await sb.from('ai_feedback').insert({
    org_id: orgId ?? null,
    user_id: userId,
    ai_type: body.aiType,
    input_context: body.inputContext,
    ai_output: body.aiOutput,
    user_action: body.userAction,
    edited_output: body.editedOutput ?? null,
    outcome_metric: body.outcomeMetric ?? null,
  });

  if (error) {
    console.error('[ai/feedback]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
