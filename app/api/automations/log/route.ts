// Phase 107 — automation log (org + LO scoped). ?status= filters approval_status.
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveLoId } from '@/lib/automations/loId';

export async function GET(request: Request) {
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ log: [] });

  const sb = createAdminClient();
  const loId = await resolveLoId(sb, userId);
  if (!loId) return NextResponse.json({ log: [] });

  const status = new URL(request.url).searchParams.get('status');
  let q = sb
    .from('milestone_automation_log')
    .select('*, lead:leads(first_name, last_name), rule:milestone_automation_rules(rule_name, action_type, requires_approval)')
    .eq('org_id', orgId)
    .eq('user_id', loId)
    .order('triggered_at', { ascending: false })
    .limit(100);
  if (status) q = q.eq('approval_status', status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ log: data ?? [] });
}
