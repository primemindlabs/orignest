// Phase 107 — one-click starter rules for the current LO (only if they have none).
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveLoId } from '@/lib/automations/loId';
import { DEFAULT_RULES } from '@/lib/automations/defaultRules';

export async function POST() {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const loId = await resolveLoId(sb, userId);
  if (!loId) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { count } = await sb
    .from('milestone_automation_rules')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('user_id', loId);
  if ((count ?? 0) > 0) return NextResponse.json({ error: 'You already have rules' }, { status: 400 });

  const { error } = await sb
    .from('milestone_automation_rules')
    .insert(DEFAULT_RULES.map((r) => ({ ...r, org_id: orgId, user_id: loId })));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, created: DEFAULT_RULES.length });
}
