// Phase 107 — LO skips a pending automation (never sent).
import { NextResponse } from 'next/server';
import { getOrgContext } from '@/lib/auth/orgContext';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveLoId } from '@/lib/automations/loId';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const { userId, orgId } = await getOrgContext();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 403 });

  const sb = createAdminClient();
  const loId = await resolveLoId(sb, userId);
  if (!loId) return NextResponse.json({ error: 'No profile' }, { status: 403 });

  const { error } = await sb
    .from('milestone_automation_log')
    .update({ approval_status: 'skipped', approved_by: loId, approved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('user_id', loId)
    .eq('approval_status', 'pending');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
