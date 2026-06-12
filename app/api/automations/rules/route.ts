// Phase 107 — milestone automation rules (list + create), org + LO scoped.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveLoId } from '@/lib/automations/loId';

const TCPA_ERROR = 'SMS automation rules must always require_approval = true (TCPA compliance)';

export async function GET() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ rules: [] });

  const sb = createAdminClient();
  const loId = await resolveLoId(sb, userId);
  if (!loId) return NextResponse.json({ rules: [] });

  const { data, error } = await sb
    .from('milestone_automation_rules')
    .select('*')
    .eq('org_id', orgId)
    .eq('user_id', loId)
    .order('trigger_stage', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(request: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const { rule_name, trigger_stage, action_type, message_template } = body;
  if (!rule_name || !trigger_stage || !action_type || !message_template) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const isSms = String(action_type).includes('sms');
  if (isSms && body.requires_approval === false) {
    return NextResponse.json({ error: TCPA_ERROR }, { status: 400 });
  }

  const sb = createAdminClient();
  const loId = await resolveLoId(sb, userId);
  if (!loId) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data, error } = await sb
    .from('milestone_automation_rules')
    .insert({
      org_id: orgId,
      user_id: loId,
      rule_name,
      trigger_stage,
      action_type,
      message_template,
      active: body.active ?? true,
      requires_approval: isSms ? true : body.requires_approval ?? true,
      auto_send_email: isSms ? false : body.auto_send_email ?? false,
      delay_minutes: body.delay_minutes ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data }, { status: 201 });
}
