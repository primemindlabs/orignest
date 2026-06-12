// Phase 107 — update / soft-delete a rule (org + LO scoped).
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveLoId } from '@/lib/automations/loId';

type Ctx = { params: Promise<{ id: string }> };
const TCPA_ERROR = 'SMS automation rules must always require_approval = true (TCPA compliance)';
const FIELDS = ['rule_name', 'trigger_stage', 'action_type', 'message_template', 'active', 'requires_approval', 'auto_send_email', 'delay_minutes'];

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  for (const f of FIELDS) if (body[f] !== undefined) updates[f] = body[f];

  if (String(updates.action_type ?? '').includes('sms')) {
    if (updates.requires_approval === false) return NextResponse.json({ error: TCPA_ERROR }, { status: 400 });
    updates.requires_approval = true;
    updates.auto_send_email = false;
  }
  updates.updated_at = new Date().toISOString();

  const sb = createAdminClient();
  const loId = await resolveLoId(sb, userId);
  if (!loId) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { data, error } = await sb
    .from('milestone_automation_rules')
    .update(updates)
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('user_id', loId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: data });
}

// Soft delete — deactivate, never remove (log entries reference rule_id).
export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const loId = await resolveLoId(sb, userId);
  if (!loId) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { error } = await sb
    .from('milestone_automation_rules')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('user_id', loId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
